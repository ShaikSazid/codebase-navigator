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

  return (
    <div className="flex h-full w-full flex-col bg-transparent font-sans text-[#EAE7E0]">
      {/* Path Breadcrumbs */}
      <div className="mb-2 flex shrink-0 items-center gap-1.5 border-b border-[#232326] pb-2 font-mono text-[11px] text-[#726E67]">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-[#9E9A92]" />
        <div className="custom-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto whitespace-nowrap">
          {pathSegments.map((segment, index) => (
            <span key={index} className="flex items-center gap-1 shrink-0">
              {index > 0 && <span className="text-[#38373B]">/</span>}
              <span className={index === pathSegments.length - 1 ? "font-semibold text-[#EAE7E0]" : "text-[#9E9A92]"}>
                {segment}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mb-2 flex shrink-0 items-center gap-1.5">
        <div className="flex flex-1 items-center gap-1.5 rounded-md border border-[#232326] bg-[#111113] px-2 py-1 transition-colors focus-within:border-[#38373B]">
          <Search className="h-3 w-3 shrink-0 text-[#726E67]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter codebase..."
            className="w-full min-w-0 bg-transparent text-[11px] text-[#EAE7E0] outline-none placeholder:text-[#55534F]"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery("")} className="text-[#726E67] hover:text-[#EAE7E0]">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={expandAll}
          title="Expand tree"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#232326] bg-[#111113] text-[#9E9A92] hover:border-[#38373B] hover:text-[#EAE7E0]"
        >
          <UnfoldVertical className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={collapseAll}
          title="Collapse tree"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#232326] bg-[#111113] text-[#9E9A92] hover:border-[#38373B] hover:text-[#EAE7E0]"
        >
          <FoldVertical className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tree Node Canvas */}
      <div className="custom-scrollbar flex-1 overflow-y-auto pr-1">
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
          <p className="px-2 py-6 text-center font-mono text-[11px] text-[#55534F]">
            No results for &quot;{searchQuery}&quot;
          </p>
        )}
      </div>
    </div>
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
  const matchesQuery = query.length > 0 && node.name.toLowerCase().includes(query);

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

  return (
    <div>
      <button
        type="button"
        onClick={() => onNodeClick(node)}
        onKeyDown={handleKeyDown}
        className={`group relative flex w-full items-center gap-1.5 rounded-md py-1 pr-1.5 text-left transition-colors duration-150 ${
          isSelected ? "bg-[#1E1E22] text-[#EAE7E0]" : "hover:bg-[#18181B] text-[#9E9A92]"
        }`}
        style={{ paddingLeft: `${depth * INDENT + 6}px` }}
      >
        {isSelected && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-[2px] rounded-r bg-[#EAE7E0]" />
        )}

        <span
          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center transition-transform ${
            isFolder ? (isExpanded ? "rotate-90" : "rotate-0") : "opacity-0"
          }`}
        >
          <ChevronRight className="h-3 w-3 text-[#726E67]" />
        </span>

        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-[#EAE7E0]" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-[#726E67] group-hover:text-[#9E9A92]" />
            )
          ) : (
            getFileIcon(node.name, isSelected)
          )}
        </span>

        <span
          className={`min-w-0 flex-1 truncate text-[12px] ${
            matchesQuery ? "underline decoration-[#55534F] underline-offset-2" : ""
          } ${isSelected ? "font-semibold text-[#EAE7E0]" : isFolder ? "font-medium text-[#C2C0B8]" : "font-mono text-[#9E9A92]"}`}
        >
          {node.name}
        </span>

        {isFolder && !isExpanded && (fileCounts.get(node.path) ?? 0) > 0 && (
          <span className="rounded bg-[#18181B] px-1 py-0.2 font-mono text-[9px] text-[#55534F]">
            {fileCounts.get(node.path)}
          </span>
        )}
      </button>

      {isFolder && isExpanded && (
        <div>
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
              className="py-1 font-mono text-[10px] italic text-[#55534F]"
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
  const cls = `h-3.5 w-3.5 shrink-0 ${isSelected ? "text-[#EAE7E0]" : "text-[#726E67]"}`;

  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return <FileCode className={cls} />;
    case "json":
      return <FileJson className={cls} />;
    case "md":
    case "txt":
      return <FileText className={cls} />;
    case "css":
    case "scss":
    case "html":
    case "py":
      return <FileCode className={cls} />;
    case "sql":
    case "csv":
      return <FileSpreadsheet className={cls} />;
    default:
      return <File className={cls} />;
  }
}