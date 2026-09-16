import { useMemo, useState, useCallback, type KeyboardEvent } from "react";
import type { RepositoryTreeNode } from "../lib/repository.api";
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileSpreadsheet,
  File,
  ChevronRight,
  Terminal,
} from "lucide-react";

export interface RepositoryTreeProps {
  tree: RepositoryTreeNode;
  onSelectFile?: (path: string, node: RepositoryTreeNode) => void;
}

const INDENT = 16;

export default function RepositoryTree({
  tree,
  onSelectFile,
}: RepositoryTreeProps) {
  const displayTree = useMemo(() => {
    const children = tree.children ?? [];
    if (
      children.length === 1 &&
      children[0].type === "folder" &&
      children[0].name === tree.name
    ) {
      return children[0];
    }
    return tree;
  }, [tree]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () => new Set([displayTree.path])
  );
  const [selectedNode, setSelectedNode] = useState<RepositoryTreeNode>(displayTree);

  const toggleFolder = useCallback((path: string) => {
    setExpandedPaths((previous) => {
      const next = new Set(previous);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    (node: RepositoryTreeNode) => {
      setSelectedNode(node);
      if (node.type === "folder") toggleFolder(node.path);
      onSelectFile?.(node.path, node);
    },
    [onSelectFile, toggleFolder]
  );

  const pathSegments = useMemo(() => {
    if (!selectedNode.path) return [displayTree.name];
    const parts = selectedNode.path.split("/").filter(Boolean);
    return parts.length > 0 ? parts : [displayTree.name];
  }, [selectedNode.path, displayTree.name]);

  return (
    <div className="flex h-full w-full flex-col bg-transparent text-[#E2E8F0] font-sans">
      {/* Breadcrumb Path Rail */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2.5 pt-0.5 mb-2.5 shrink-0 bg-transparent">
        <Terminal className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
        <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap font-mono text-[12px] tracking-tight text-slate-400 custom-scrollbar bg-transparent">
          {pathSegments.map((segment, index) => (
            <span key={index} className="flex items-center gap-1.5 shrink-0 bg-transparent">
              {index > 0 && <span className="text-slate-600">/</span>}
              <span
                className={
                  index === pathSegments.length - 1
                    ? "text-indigo-300 font-semibold"
                    : "text-slate-400 hover:text-white transition-colors"
                }
              >
                {segment}
              </span>
            </span>
          ))}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }

        @keyframes tree-reveal {
          from { opacity: 0; transform: translateY(-2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tree-branch { animation: tree-reveal 120ms ease-out; }
      `}</style>

      {/* Tree Canvas */}
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1 bg-transparent">
        <RepositoryTreeNodeView
          node={displayTree}
          depth={0}
          expandedPaths={expandedPaths}
          selectedPath={selectedNode.path}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
}

interface RepositoryTreeNodeViewProps {
  node: RepositoryTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  selectedPath: string | null;
  onNodeClick: (node: RepositoryTreeNode) => void;
}

function RepositoryTreeNodeView({
  node,
  depth,
  expandedPaths,
  selectedPath,
  onNodeClick,
}: RepositoryTreeNodeViewProps) {
  const isFolder = node.type === "folder";
  const isExpanded = isFolder && expandedPaths.has(node.path);
  const isSelected = selectedPath === node.path;

  const children = useMemo(() => {
    return [...(node.children ?? [])].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [node.children]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNodeClick(node);
    }
  };

  return (
    <div className="bg-transparent">
      <button
        type="button"
        onClick={() => onNodeClick(node)}
        onKeyDown={handleKeyDown}
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-current={isSelected ? "true" : undefined}
        className="group relative flex w-full items-center gap-2 py-[5px] pr-2 text-left outline-none transition-all duration-150 cursor-pointer bg-transparent"
        style={{ paddingLeft: `${depth * INDENT + 6}px` }}
      >
        {isSelected && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2.5px] rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
        )}

        {Array.from({ length: depth }).map((_, i) => (
          <span
            key={i}
            className="pointer-events-none absolute top-0 h-full w-px bg-white/[0.07]"
            style={{ left: `${i * INDENT + 12}px` }}
          />
        ))}

        <span
          className={`relative z-10 flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-transform duration-150 ${
            isSelected
              ? "text-indigo-400"
              : "text-slate-500 group-hover:text-slate-300"
          } ${isFolder ? (isExpanded ? "rotate-90" : "rotate-0") : "opacity-0"}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </span>

        <span className="relative z-10 flex h-4 w-4 shrink-0 items-center justify-center">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4 text-indigo-400 shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-slate-400 group-hover:text-indigo-300 transition-colors shrink-0" />
            )
          ) : (
            getFileIcon(node.name, isSelected)
          )}
        </span>

        <span
          className={`relative z-10 min-w-0 flex-1 truncate tracking-tight transition-colors ${
            isSelected
              ? "text-[13.5px] font-medium text-indigo-200"
              : isFolder
              ? "text-[13.5px] font-medium text-slate-200 group-hover:text-white"
              : "font-mono text-[12.5px] text-slate-400 group-hover:text-slate-200"
          }`}
        >
          {node.name}
        </span>
      </button>

      {isFolder && isExpanded && (
        <div className="tree-branch bg-transparent">
          {children.length > 0 ? (
            children.map((child) => (
              <RepositoryTreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                selectedPath={selectedPath}
                onNodeClick={onNodeClick}
              />
            ))
          ) : (
            <div
              className="relative py-1.5 font-mono text-[11px] italic text-slate-500 bg-transparent"
              style={{ paddingLeft: `${(depth + 1) * INDENT + 6}px` }}
            >
              {Array.from({ length: depth + 1 }).map((_, i) => (
                <span
                  key={i}
                  className="pointer-events-none absolute top-0 h-full w-px bg-white/[0.07]"
                  style={{ left: `${i * INDENT + 12}px` }}
                />
              ))}
              <span className="relative z-10">empty directory</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getFileIcon(fileName: string, isSelected: boolean) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const cls = `h-4 w-4 shrink-0 transition-opacity ${
    isSelected ? "opacity-100" : "opacity-85"
  }`;

  switch (ext) {
    case "ts":
    case "tsx":
      return <FileCode className={`${cls} text-cyan-400`} />;
    case "js":
    case "jsx":
      return <FileCode className={`${cls} text-amber-400`} />;
    case "json":
      return <FileJson className={`${cls} text-emerald-400`} />;
    case "md":
    case "txt":
      return <FileText className={`${cls} text-slate-400`} />;
    case "css":
    case "scss":
    case "html":
      return <FileCode className={`${cls} text-pink-400`} />;
    case "py":
      return <FileCode className={`${cls} text-indigo-400`} />;
    case "sql":
    case "csv":
      return <FileSpreadsheet className={`${cls} text-teal-400`} />;
    default:
      return <File className={`${cls} text-slate-500`} />;
  }
}