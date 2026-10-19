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
  FileText,
} from "lucide-react";

// ---------- Tree Builder ----------

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

    const subNodeId = layer.name;
    const subNode: TreeNode = {
      id: subNodeId,
      label: childLabel || layer.name,
      description: layer.description,
      files: layer.files,
      children: [],
      nodeType: hasGroup ? "subgroup" : "group",
    };

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

const NODE_WIDTH = 250;
const ROW_HEIGHT = 68;
const COL_WIDTH = 310;

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
          style: { stroke: depth === 0 ? "#8A6B3A" : "#34343A", strokeWidth: depth === 0 ? 1.75 : 1.25 },
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

// ---------- Node Component ----------

interface TreeNodeCardProps {
  id: string;
  data: TreeNodeData;
}

function TreeNodeCard({ id, data }: TreeNodeCardProps) {
  const { label, hasChildren, expanded, nodeType, fileCount, isHighlighted, onToggle } = data;

  let cardStyle = "bg-[#141417] border-[#232326] text-[#9E9A92]";
  let iconStyle = "text-[#726E67]";
  let Icon = Folder;

  if (nodeType === "root") {
    cardStyle = "bg-[#EAE7E0] border-[#EAE7E0] text-[#0D0D0E] font-semibold shadow-[0_0_40px_-6px_rgba(212,163,89,0.45)]";
    iconStyle = "text-[#0D0D0E]";
    Icon = GitFork;
  } else if (nodeType === "group" || nodeType === "subgroup") {
    cardStyle = expanded
      ? "bg-[#18181B] border-[#D4A359]/50 text-[#EAE7E0] shadow-[0_8px_24px_-10px_rgba(0,0,0,0.8)]"
      : "bg-[#141417] border-[#2B2B30] text-[#C2C0B8] hover:border-[#4A4850]";
    iconStyle = expanded ? "text-[#D4A359]" : "text-[#9E9A92]";
    Icon = expanded ? FolderOpen : Folder;
  } else if (nodeType === "desc") {
    cardStyle = "border-dashed bg-transparent border-[#26262A] text-[#726E67] italic text-[11.5px]";
    Icon = FileText;
  } else if (nodeType === "file") {
    cardStyle = "bg-[#0F0F11] border-[#1E1E21] text-[#9E9A92] text-[12px] hover:border-[#3A3940] hover:text-[#EAE7E0]";
    Icon = FileCode;
  } else if (nodeType === "more") {
    cardStyle = "border-dashed bg-transparent border-[#2B2B30] text-[#726E67] text-[12px]";
    Icon = FileCode;
  }

  const searchHighlight = isHighlighted
    ? "!border-[#D4A359] ring-2 ring-[#D4A359]/40 ring-offset-2 ring-offset-[#0D0D0E] scale-[1.04]"
    : "";

  return (
    <div
      onClick={() => hasChildren && onToggle(id)}
      className={`group relative flex select-none items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition-all duration-200 ${hasChildren ? "cursor-pointer" : "cursor-default"} ${cardStyle} ${searchHighlight}`}
      style={{ width: NODE_WIDTH }}
    >
      <Handle type="target" position={Position.Left} className="!w-1 !opacity-0" />

      <Icon className={`h-4 w-4 shrink-0 ${iconStyle}`} />

      <span className={`flex-1 truncate text-[13px] tracking-tight ${nodeType === "file" ? "font-mono" : "font-medium"}`}>
        {label}
      </span>

      {hasChildren && fileCount > 0 && nodeType !== "root" && (
        <span className="rounded-full bg-[#1F1F23] px-2 py-0.5 font-mono text-[10px] text-[#9E9A92]">
          {fileCount}
        </span>
      )}

      {hasChildren && (
        <div className={`ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
          nodeType === "root"
            ? "bg-black/10 text-[#0D0D0E] group-hover:bg-black/20"
            : "bg-white/5 text-[#9E9A92] group-hover:bg-[#D4A359]/20 group-hover:text-[#D4A359]"
        }`}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!w-1 !opacity-0" />
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
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-[#232326] bg-[#0D0D0E]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_20%_40%,rgba(212,163,89,0.07),transparent_60%)]" />

      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-[#232326] bg-[#111113]/85 p-1.5 shadow-2xl backdrop-blur-xl">
        <div className="relative flex items-center">
          <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#726E67]" />
          <input
            type="text"
            placeholder="Search files or layers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-56 rounded-lg border border-[#232326] bg-[#0D0D0E] py-1.5 pl-8 pr-3 text-xs text-[#EAE7E0] transition-colors duration-300 placeholder:text-[#55534F] focus:border-[#D4A359]/60 focus:outline-none"
          />
        </div>

        <div className="h-4 w-px bg-[#232326]" />

        <button
          onClick={expandAll}
          title="Expand All Nodes"
          className="rounded-lg p-1.5 text-[#9E9A92] transition-colors duration-300 hover:bg-[#1F1F23] hover:text-[#D4A359]"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={collapseAll}
          title="Collapse to Root"
          className="rounded-lg p-1.5 text-[#9E9A92] transition-colors duration-300 hover:bg-[#1F1F23] hover:text-[#D4A359]"
        >
          <Minimize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 right-4 z-10 rounded-lg border border-[#232326] bg-[#111113]/85 px-3 py-1.5 font-mono text-[10.5px] text-[#726E67] backdrop-blur-xl">
        Click a folder to expand · Scroll to zoom
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
        <Background variant={BackgroundVariant.Dots} color="#26262A" gap={26} size={1.2} />
        <Controls
          showInteractive={false}
          className="!overflow-hidden !rounded-xl !border !border-[#232326] !bg-[#111113]/90 !shadow-2xl !backdrop-blur-xl [&_button]:!border-[#232326] [&_button]:!bg-transparent [&_button]:!fill-[#9E9A92] hover:[&_button]:!bg-[#1F1F23] hover:[&_button]:!fill-[#D4A359]"
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