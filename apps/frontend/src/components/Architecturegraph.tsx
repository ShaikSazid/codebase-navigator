import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { ArchitectureLayer } from "../lib/repository.api";
import { 
  Folder, 
  FolderOpen,
  FileCode, 
  ChevronRight, 
  ChevronDown, 
  GitFork, 
  Search, 
  Maximize2, 
  Minimize2,
  FileText 
} from "lucide-react";

// ---------- Tree Builder (Fixed Leaf Attachment) ----------

interface TreeNode {
  id: string;
  label: string;
  description?: string;
  files: string[];
  children?: TreeNode[];
  nodeType: "root" | "group" | "subgroup" | "desc" | "file" | "more";
}

function buildTree(layers: ArchitectureLayer[], rootLabel: string): TreeNode {
  const groups = new Map<string, TreeNode>();
  const order: string[] = [];

  for (const layer of layers) {
    const sep = layer.name.indexOf(" - ");
    const hasGroup = sep !== -1;
    const groupLabel = hasGroup ? layer.name.slice(0, sep) : layer.name;
    const childLabel = hasGroup ? layer.name.slice(sep + 3) : null;

    if (!groups.has(groupLabel)) {
      groups.set(groupLabel, { 
        id: groupLabel, 
        label: groupLabel, 
        files: [],
        children: [],
        nodeType: "group",
      });
      order.push(groupLabel);
    }

    const group = groups.get(groupLabel)!;

    // Build sub-layer node
    const subNodeId = layer.name;
    const subNode: TreeNode = {
      id: subNodeId,
      label: childLabel || layer.name,
      description: layer.description,
      files: layer.files,
      children: [],
      nodeType: hasGroup ? "subgroup" : "group",
    };

    // Attach File Children directly to the subNode so they expand as real nodes
    if (layer.description) {
      subNode.children!.push({
        id: `${subNodeId}-desc`,
        label: layer.description,
        files: [],
        nodeType: "desc",
      });
    }

    const maxFiles = 6;
    const filesToDisplay = layer.files.slice(0, maxFiles);
    filesToDisplay.forEach((file) => {
      subNode.children!.push({
        id: `${subNodeId}-file-${file}`,
        label: file.split("/").pop() ?? file,
        files: [],
        nodeType: "file",
      });
    });

    if (layer.files.length > maxFiles) {
      subNode.children!.push({
        id: `${subNodeId}-more`,
        label: `+${layer.files.length - maxFiles} more files`,
        files: [],
        nodeType: "more",
      });
    }

    if (hasGroup) {
      group.children!.push(subNode);
      group.files.push(...layer.files);
    } else {
      groups.set(groupLabel, subNode);
    }
  }

  const topLevel = order.map((id) => groups.get(id)!);

  return {
    id: "root",
    label: rootLabel,
    files: [],
    nodeType: "root",
    children: topLevel,
  };
}

// ---------- Layout Engine ----------

const NODE_WIDTH = 240;
const ROW_HEIGHT = 68;
const COL_WIDTH = 300;

interface TreeNodeData {
  label: string;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  nodeType: string;
  fileCount: number;
  isHighlighted: boolean;
  onToggle: (id: string) => void;
  [key: string]: unknown;
}

interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: TreeNodeData;
  draggable?: boolean;
  selectable?: boolean;
}

interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
  style?: { stroke: string; strokeWidth: number };
}

interface FlowResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

function layout(
  root: TreeNode,
  expanded: Set<string>,
  onToggle: (id: string) => void,
  searchQuery: string = ""
): FlowResult {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const counter = { row: 0 };

  function visit(node: TreeNode, depth: number): number {
    const hasChildren = !!node.children && node.children.length > 0;
    const isExpanded = expanded.has(node.id);

    let y: number;
    const childYs: number[] = [];

    if (!hasChildren || !isExpanded) {
      y = counter.row * ROW_HEIGHT;
      counter.row += 1;
    } else {
      for (const child of node.children!) {
        childYs.push(visit(child, depth + 1));
        edges.push({
          id: `${node.id}->${child.id}`,
          source: node.id,
          target: child.id,
          type: "smoothstep",
          animated: depth === 0,
          style: { stroke: "#3A3A3A", strokeWidth: 1.5 },
        });
      }
      y = (Math.min(...childYs) + Math.max(...childYs)) / 2;
    }

    const isHighlighted = 
      searchQuery.length > 0 && 
      node.label.toLowerCase().includes(searchQuery.toLowerCase());

    nodes.push({
      id: node.id,
      type: "treeNode",
      position: { x: depth * COL_WIDTH, y },
      data: {
        label: node.label,
        depth,
        hasChildren,
        expanded: isExpanded,
        nodeType: node.nodeType,
        fileCount: node.files?.length || node.children?.filter(c => c.nodeType === "file").length || 0,
        isHighlighted,
        onToggle,
      },
      draggable: false,
      selectable: false,
    });

    return y;
  }

  visit(root, 0);
  return { nodes, edges };
}

// ---------- Mind Map Node Component ----------

interface TreeNodeCardProps {
  id: string;
  data: TreeNodeData;
}

function TreeNodeCard({ id, data }: TreeNodeCardProps) {
  const { label, hasChildren, expanded, nodeType, fileCount, isHighlighted, onToggle } = data;

  let cardStyle = "bg-[#1A1A1A] border-[#2A2A2A] text-[#B0B0B0] hover:border-[#3A3A3A]";
  let Icon = Folder;

  if (nodeType === "root") {
    cardStyle = "bg-[#E0E0E0] border-[#E0E0E0] text-[#121212] shadow-lg shadow-black/40 font-semibold";
    Icon = GitFork;
  } else if (nodeType === "group" || nodeType === "subgroup") {
    cardStyle = expanded 
      ? "bg-[#1A1A1A] border-[#555555] text-[#E0E0E0] shadow-md ring-1 ring-[#3A3A3A]" 
      : "bg-[#161616] border-[#2A2A2A] text-[#B0B0B0] hover:border-[#3A3A3A]";
    Icon = expanded ? FolderOpen : Folder;
  } else if (nodeType === "desc") {
    cardStyle = "bg-[#121212]/60 border-[#242424] text-[#666666] italic text-[12px]";
    Icon = FileText;
  } else if (nodeType === "file") {
    cardStyle = "bg-[#121212]/90 border-[#242424] text-[#B0B0B0] text-[12px] hover:border-[#3A3A3A]";
    Icon = FileCode;
  } else if (nodeType === "more") {
    cardStyle = "bg-[#1A1A1A]/60 border-[#2A2A2A] text-[#888888] text-[12px] font-medium";
    Icon = FileCode;
  }

  const searchHighlight = isHighlighted 
    ? "ring-2 ring-[#E0E0E0] ring-offset-2 ring-offset-[#121212] scale-105" 
    : "";

  return (
    <div
      onClick={() => hasChildren && onToggle(id)}
      className={`group relative flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 transition-all duration-200 border select-none backdrop-blur-md ${hasChildren ? "cursor-pointer" : "cursor-default"} ${cardStyle} ${searchHighlight}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0 !w-1" />

      <Icon className={`w-4 h-4 shrink-0 ${nodeType === "root" ? "text-[#121212]" : nodeType === "file" ? "text-[#888888]" : "text-[#B0B0B0]"}`} />

      <span className="truncate font-medium text-[13px] tracking-tight flex-1">
        {label}
      </span>

      {/* File count indicator */}
      {hasChildren && fileCount > 0 && nodeType !== "root" && (
        <span className="text-[10px] bg-[#242424] text-[#888888] px-2 py-0.5 rounded-full font-mono">
          {fileCount}
        </span>
      )}

      {/* Toggle Arrow */}
      {hasChildren && (
        <div className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
          nodeType === "root"
            ? "bg-black/10 group-hover:bg-black/20 text-[#121212]"
            : "bg-white/5 group-hover:bg-white/10 text-[#B0B0B0]"
        }`}>
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!opacity-0 !w-1" />
    </div>
  );
}

const nodeTypes = { treeNode: TreeNodeCard };

// ---------- Main Export ----------

interface ArchitectureGraphProps {
  layers: ArchitectureLayer[];
  repositoryLabel: string;
}

function GraphInner({ layers, repositoryLabel }: ArchitectureGraphProps) {
  const tree = useMemo(
    () => buildTree(layers, repositoryLabel),
    [layers, repositoryLabel],
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set(["root"]));
  const [searchQuery, setSearchQuery] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<FlowEdge>([]);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (n: TreeNode) => {
      all.add(n.id);
      n.children?.forEach(collect);
    };
    collect(tree);
    setExpanded(all);
  };

  const collapseAll = () => {
    setExpanded(new Set(["root"]));
  };

  useEffect(() => {
    const { nodes: n, edges: e } = layout(tree, expanded, toggle, searchQuery);
    setNodes(n);
    setEdges(e);
  }, [tree, expanded, toggle, searchQuery, setNodes, setEdges]);

  return (
    <div className="relative w-full h-full bg-[#121212] overflow-hidden rounded-xl border border-[#2A2A2A]">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-[#1A1A1A]/90 backdrop-blur-md p-1.5 rounded-lg border border-[#2A2A2A] shadow-xl">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-[#666666] absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Search files or layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-48 bg-[#121212] text-[#E0E0E0] text-xs pl-8 pr-3 py-1.5 rounded-md border border-[#2A2A2A] focus:outline-none focus:border-[#555555] transition-colors duration-300"
          />
        </div>

        <div className="h-4 w-[1px] bg-[#2A2A2A]" />

        <button
          onClick={expandAll}
          title="Expand All Nodes"
          className="p-1.5 text-[#888888] hover:text-[#E0E0E0] hover:bg-[#242424] rounded-md transition-colors duration-300"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={collapseAll}
          title="Collapse to Root"
          className="p-1.5 text-[#888888] hover:text-[#E0E0E0] hover:bg-[#242424] rounded-md transition-colors duration-300"
        >
          <Minimize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={1.5}
      >
        <Background variant={BackgroundVariant.Dots} color="#242424" gap={24} size={1} />
        <Controls
          showInteractive={false}
          className="!border-[#2A2A2A] !bg-[#1A1A1A]/90 !backdrop-blur-md !rounded-lg overflow-hidden [&_button]:!border-[#2A2A2A] [&_button]:!bg-transparent [&_button]:!fill-[#B0B0B0] hover:[&_button]:!bg-[#242424]"
        />
      </ReactFlow>
    </div>
  );
}

export default function ArchitectureGraph(props: ArchitectureGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}