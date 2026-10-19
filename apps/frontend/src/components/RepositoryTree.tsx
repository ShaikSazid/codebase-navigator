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
  FileSearch,
  ChevronRight,
  Search,
  X,
  FoldVertical,
  UnfoldVertical,
} from "lucide-react";

export interface RepositoryTreeProps {
  tree: RepositoryTreeNode;
  onSelectFile?: (path: string, node: RepositoryTreeNode) => void;
}

const INDENT = 14;

function countFiles(node: RepositoryTreeNode): number {
  if (node.type !== "folder") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countFiles(child), 0);
}

function nodeMatches(node: RepositoryTreeNode, query: string): boolean {
  if (node.name.toLowerCase().includes(query)) return true;
  return (node.children ?? []).some((child) => nodeMatches(child, query));
}

export default function RepositoryTree({ tree, onSelectFile }: RepositoryTreeProps) {
  const displayTree = useMemo(() => {
    const children = tree.children ?? [];
    if (children.length === 1 && children[0].type === "folder" && children[0].name === tree.name) {
      return children[0];
    }
    return tree;
  }, [tree]);

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => new Set([displayTree.path]));
  const [selectedNode, setSelectedNode] = useState<RepositoryTreeNode>(displayTree);
  const [searchQuery, setSearchQuery] = useState("");

  const fileCounts = useMemo(() => {
    const map = new Map<string, number>();
    const visit = (node: RepositoryTreeNode) => {
      if (node.type === "folder") {
        map.set(node.path, countFiles(node));
        node.children?.forEach(visit);
      }
    };
    visit(displayTree);
    return map;
  }, [displayTree]);

  const searchExpandedPaths = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.trim().toLowerCase();
    const paths = new Set<string>();
    const visit = (node: RepositoryTreeNode): boolean => {
      const selfMatch = node.name.toLowerCase().includes(q);
      const childMatch = (node.children ?? []).map(visit).some(Boolean);
      if ((selfMatch || childMatch) && node.type === "folder") {
        paths.add(node.path);
      }
      return selfMatch || childMatch;
    };
    visit(displayTree);
    return paths;
  }, [displayTree, searchQuery]);

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

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const visit = (node: RepositoryTreeNode) => {
      if (node.type === "folder") {
        all.add(node.path);
        node.children?.forEach(visit);
      }
    };
    visit(displayTree);
    setExpandedPaths(all);
  }, [displayTree]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set([displayTree.path]));
  }, [displayTree]);

  const pathSegments = useMemo(() => {
    if (!selectedNode.path) return [displayTree.name];
    const parts = selectedNode.path.split("/").filter(Boolean);
    return parts.length > 0 ? parts : [displayTree.name];
  }, [selectedNode.path, displayTree.name]);

  const query = searchQuery.trim().toLowerCase();
  const treeVisible = !query || nodeMatches(displayTree, query);
  const totalFiles = fileCounts.get(displayTree.path) ?? 0;

  return (
    <div className="flex h-full w-full flex-col bg-transparent text-[#EAE7E0]">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between px-1.5 pt-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-semibold tracking-tight text-[#EAE7E0]">Explorer</span>
          <span className="font-mono text-[10.5px] text-[#55534F]">{totalFiles} files</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={expandAll}
            title="Expand all"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#726E67] transition-colors hover:bg-[#1B1B1E] hover:text-[#D4A359]"
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="Collapse all"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#726E67] transition-colors hover:bg-[#1B1B1E] hover:text-[#D4A359]"
          >
            <FoldVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-2.5 shrink-0">
        <div className="flex items-center gap-2 rounded-lg border border-[#232326] bg-[#0E0E10] px-2.5 py-1.5 transition-all duration-200 focus-within:border-[#D4A359]/50 focus-within:shadow-[0_0_0_3px_rgba(212,163,89,0.08)]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#726E67]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full min-w-0 bg-transparent text-[12.5px] text-[#EAE7E0] outline-none placeholder:text-[#55534F]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#726E67] hover:text-[#EAE7E0]"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Nodes */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
        {treeVisible ? (
          <RepositoryTreeNodeView
            node={displayTree}
            depth={0}
            expandedPaths={expandedPaths}
            searchExpandedPaths={searchExpandedPaths}
            selectedPath={selectedNode.path}
            onNodeClick={handleNodeClick}
            query={query}
            fileCounts={fileCounts}
          />
        ) : (
          <div className="flex flex-col items-center px-2 py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#232326] bg-[#141417]">
              <FileSearch className="h-4 w-4 text-[#726E67]" />
            </div>
            <p className="mt-3 text-[12.5px] text-[#9E9A92]">No matches</p>
            <p className="mt-0.5 text-[11.5px] text-[#55534F]">Nothing found for &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>

      {/* Path bar */}
      <div className="mt-2.5 shrink-0 border-t border-[#1E1E21] pt-2.5">
        <div className="custom-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap px-1.5 pb-1 font-mono text-[11px]">
          {pathSegments.map((segment, index) => (
            <span key={index} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight className="h-2.5 w-2.5 text-[#38373B]" />}
              <span className={index === pathSegments.length - 1 ? "text-[#E8C48A]" : "text-[#726E67]"}>
                {segment}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const index = text.toLowerCase().indexOf(query);
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-[#D4A359]/25 px-px text-[#E8C48A]">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

interface RepositoryTreeNodeViewProps {
  node: RepositoryTreeNode;
  depth: number;
  expandedPaths: Set<string>;
  searchExpandedPaths: Set<string>;
  selectedPath: string | null;
  onNodeClick: (node: RepositoryTreeNode) => void;
  query: string;
  fileCounts: Map<string, number>;
}

function RepositoryTreeNodeView({
  node,
  depth,
  expandedPaths,
  searchExpandedPaths,
  selectedPath,
  onNodeClick,
  query,
  fileCounts,
}: RepositoryTreeNodeViewProps) {
  const isFolder = node.type === "folder";
  const isExpanded = isFolder && (expandedPaths.has(node.path) || searchExpandedPaths.has(node.path));
  const isSelected = selectedPath === node.path;

  const children = useMemo(() => {
    const sorted = [...(node.children ?? [])].sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (!query) return sorted;
    return sorted.filter((child) => nodeMatches(child, query));
  }, [node.children, query]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNodeClick(node);
    }
  };

  const count = fileCounts.get(node.path) ?? 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => onNodeClick(node)}
        onKeyDown={handleKeyDown}
        className={`group relative flex w-full items-center gap-1.5 rounded-lg py-[6px] pr-2 text-left outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[#D4A359]/50 ${
          isSelected ? "bg-[#D4A359]/[0.10]" : "hover:bg-[#161618]"
        }`}
        style={{ paddingLeft: `${depth * INDENT + 6}px` }}
      >
        {isSelected && (
          <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-[#D4A359]" />
        )}

        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-transform duration-200 ${
            isFolder ? (isExpanded ? "rotate-90" : "rotate-0") : "opacity-0"
          }`}
        >
          <ChevronRight className="h-3 w-3 text-[#55534F] group-hover:text-[#9E9A92]" />
        </span>

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-[#D4A359]" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-[#8A8780] group-hover:text-[#C2C0B8]" />
            )
          ) : (
            getFileIcon(node.name, isSelected)
          )}
        </span>

        <span
          className={`min-w-0 flex-1 truncate ${
            isFolder
              ? `text-[12.5px] font-medium ${isSelected ? "text-[#EAE7E0]" : "text-[#C2C0B8]"}`
              : `font-mono text-[12px] ${
                  isSelected ? "text-[#EAE7E0]" : "text-[#9E9A92] group-hover:text-[#EAE7E0]"
                }`
          }`}
        >
          <Highlight text={node.name} query={query} />
        </span>

        {isFolder && !isExpanded && count > 0 && (
          <span className="font-mono text-[10px] text-[#55534F] group-hover:text-[#726E67]">{count}</span>
        )}
      </button>

      {isFolder && isExpanded && (
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute bottom-1 top-0 w-px bg-[#1E1E21] transition-colors group-hover:bg-[#2B2B30]"
            style={{ left: `${depth * INDENT + 6 + 7}px` }}
          />
          {children.length > 0 ? (
            children.map((child) => (
              <RepositoryTreeNodeView
                key={child.path}
                node={child}
                depth={depth + 1}
                expandedPaths={expandedPaths}
                searchExpandedPaths={searchExpandedPaths}
                selectedPath={selectedPath}
                onNodeClick={onNodeClick}
                query={query}
                fileCounts={fileCounts}
              />
            ))
          ) : (
            <div
              className="py-1 text-[11px] italic text-[#55534F]"
              style={{ paddingLeft: `${(depth + 1) * INDENT + 6}px` }}
            >
              empty directory
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getFileIcon(fileName: string, isSelected: boolean) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  const base = "h-3.5 w-3.5 shrink-0";

  // Subtle, warm-toned tints per file kind; selected rows use the gold accent
  const tint = (color: string) => (isSelected ? "text-[#D4A359]" : color);

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className={`${base} ${tint("text-[#B8976A]")}`} />;
    case "json":
      return <FileJson className={`${base} ${tint("text-[#A3AE86]")}`} />;
    case "md":
    case "txt":
      return <FileText className={`${base} ${tint("text-[#8FA0AD]")}`} />;
    case "css":
    case "scss":
    case "html":
    case "py":
      return <FileCode className={`${base} ${tint("text-[#B58F9F]")}`} />;
    case "sql":
    case "csv":
      return <FileSpreadsheet className={`${base} ${tint("text-[#8FAE9E]")}`} />;
    default:
      return <File className={`${base} ${tint("text-[#726E67]")}`} />;
  }
}