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
    <div className="flex h-full w-full flex-col bg-transparent text-[#22223B]">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between px-1.5 pt-1">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[14px]">Files</span>
          <span className="font-mono text-[10.5px] text-[#5F6380]">{totalFiles}</span>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={expandAll}
            title="Expand all folders"
            aria-label="Expand all folders"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#4A4E69] transition-colors hover:bg-[#22223B]/[0.08] hover:text-[#22223B]"
          >
            <UnfoldVertical className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={collapseAll}
            title="Collapse all folders"
            aria-label="Collapse all folders"
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#4A4E69] transition-colors hover:bg-[#22223B]/[0.08] hover:text-[#22223B]"
          >
            <FoldVertical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-2.5 shrink-0">
        <div className="flex items-center gap-2 rounded-full border border-[#4A4E69]/35 bg-white/60 px-3 py-1.5 transition-colors focus-within:border-[#22223B]">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#4A4E69]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files"
            aria-label="Search files"
            className="w-full min-w-0 bg-transparent text-[13px] text-[#22223B] outline-none placeholder:text-[#6B6F88]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[#4A4E69] hover:text-[#22223B]"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#4A4E69]/30 bg-white/60">
              <FileSearch className="h-4 w-4 text-[#4A4E69]" />
            </div>
            <p className="mt-3 text-[13px] font-medium">No matching files</p>
            <p className="mt-0.5 text-[12px] text-[#5F6380]">Nothing found for &quot;{searchQuery}&quot;</p>
          </div>
        )}
      </div>

      {/* Path bar */}
      <div className="mt-2.5 shrink-0 border-t border-[#4A4E69]/20 pt-2.5">
        <div className="custom-scrollbar flex items-center gap-1 overflow-x-auto whitespace-nowrap px-1.5 pb-1 font-mono text-[11px]">
          {pathSegments.map((segment, index) => (
            <span key={index} className="flex shrink-0 items-center gap-1">
              {index > 0 && <ChevronRight className="h-2.5 w-2.5 text-[#6B6F88]" />}
              <span className={index === pathSegments.length - 1 ? "font-medium text-[#22223B]" : "text-[#5F6380]"}>
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
      <mark className="rounded-sm bg-[#22223B]/15 px-px text-[#22223B]">
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
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-current={isSelected ? "true" : undefined}
        className={`group relative flex w-full items-center gap-1.5 rounded-lg py-[6px] pr-2 text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#22223B]/60 ${
          isSelected ? "bg-[#22223B]/[0.10]" : "hover:bg-[#22223B]/[0.05]"
        }`}
        style={{ paddingLeft: `${depth * INDENT + 6}px` }}
      >
        {isSelected && (
          <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-[#22223B]" />
        )}

        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-transform duration-200 ${
            isFolder ? (isExpanded ? "rotate-90" : "rotate-0") : "opacity-0"
          }`}
        >
          <ChevronRight className="h-3 w-3 text-[#5F6380] group-hover:text-[#22223B]" />
        </span>

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-[#22223B]" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-[#4A4E69] group-hover:text-[#22223B]" />
            )
          ) : (
            getFileIcon(node.name, isSelected)
          )}
        </span>

        <span
          className={`min-w-0 flex-1 truncate ${
            isFolder
              ? `text-[13px] font-medium ${isSelected ? "text-[#22223B]" : "text-[#2E2F4A]"}`
              : `font-mono text-[12px] ${isSelected ? "font-medium text-[#22223B]" : "text-[#4A4E69] group-hover:text-[#22223B]"}`
          }`}
        >
          <Highlight text={node.name} query={query} />
        </span>

        {isFolder && !isExpanded && count > 0 && (
          <span className="font-mono text-[10px] text-[#5F6380]">{count}</span>
        )}
      </button>

      {isFolder && isExpanded && (
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute bottom-1 top-0 w-px bg-[#4A4E69]/20"
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
              className="py-1 text-[11.5px] italic text-[#5F6380]"
              style={{ paddingLeft: `${(depth + 1) * INDENT + 6}px` }}
            >
              empty folder
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

  // Muted tints per file kind on cream; the selected row uses the ink color
  const tint = (color: string) => (isSelected ? "text-[#22223B]" : color);

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className={`${base} ${tint("text-[#4A4E69]")}`} />;
    case "json":
      return <FileJson className={`${base} ${tint("text-[#5E7A4F]")}`} />;
    case "md":
    case "txt":
      return <FileText className={`${base} ${tint("text-[#4F7389]")}`} />;
    case "css":
    case "scss":
    case "html":
    case "py":
      return <FileCode className={`${base} ${tint("text-[#8A4F6B]")}`} />;
    case "sql":
    case "csv":
      return <FileSpreadsheet className={`${base} ${tint("text-[#4F8A72]")}`} />;
    default:
      return <File className={`${base} ${tint("text-[#6B6F88]")}`} />;
  }
}