import { useMemo, useState } from "react";

import type { RepositoryTreeNode } from "../lib/repository.api";

interface RepositoryTreeProps {
  tree: RepositoryTreeNode;
}

function RepositoryTree({
  tree,
}: RepositoryTreeProps) {
  const [currentNode, setCurrentNode] =
    useState<RepositoryTreeNode>(tree);

  const [history, setHistory] = useState<
    RepositoryTreeNode[]
  >([]);

  const children = useMemo(() => {
    return [...(currentNode.children ?? [])].sort(
      (a, b) => {
        // Folders first
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }

        // Then alphabetical
        return a.name.localeCompare(b.name);
      },
    );
  }, [currentNode]);

  function openNode(node: RepositoryTreeNode) {
    if (node.type !== "folder") {
      return;
    }

    setHistory((previous) => [
      ...previous,
      currentNode,
    ]);

    setCurrentNode(node);
  }

  function goBack() {
    const previousNode =
      history[history.length - 1];

    if (!previousNode) {
      return;
    }

    setHistory((previous) =>
      previous.slice(0, -1),
    );

    setCurrentNode(previousNode);
  }

  function goToRoot() {
    setCurrentNode(tree);
    setHistory([]);
  }

  return (
    <div className="flex h-full flex-col bg-[#0E0F12]">
      {/* Header */}
      <div className="border-b border-[#1E2027] px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#6B7080]">
              Repository
            </p>

            <h2 className="mt-1 truncate text-[18px] font-medium text-white">
              {currentNode.name}
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={goBack}
              disabled={history.length === 0}
              className="rounded-md border border-[#1E2027] px-3 py-1.5 text-[12px] text-[#B0B4BD] transition hover:border-[#30333D] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={goToRoot}
              disabled={history.length === 0}
              className="rounded-md border border-[#1E2027] px-3 py-1.5 text-[12px] text-[#B0B4BD] transition hover:border-[#30333D] hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
            >
              Root
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="mt-3 flex items-center gap-1 overflow-x-auto font-mono text-[11px]">
          <button
            type="button"
            onClick={goToRoot}
            className="shrink-0 text-[#8A8F98] hover:text-white"
          >
            {tree.name}
          </button>

          {history.slice(1).map((node) => (
            <span
              key={node.path}
              className="flex shrink-0 items-center gap-1"
            >
              <span className="text-[#3F424B]">
                /
              </span>

              <span className="text-[#6B7080]">
                {node.name}
              </span>
            </span>
          ))}

          {currentNode !== tree && (
            <>
              <span className="text-[#3F424B]">
                /
              </span>

              <span className="text-[#B0B4BD]">
                {currentNode.name}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="mx-auto max-w-[900px]">
          {/* Current folder */}
          <div className="mb-5 flex items-center gap-2">
            <span className="text-[20px]">
              {currentNode.type === "folder"
                ? "📁"
                : "📄"}
            </span>

            <span className="text-[15px] font-medium text-white">
              {currentNode.name}
            </span>

            <span className="font-mono text-[11px] text-[#6B7080]">
              {children.length}{" "}
              {children.length === 1
                ? "item"
                : "items"}
            </span>
          </div>

          {/* Children */}
          {children.length > 0 ? (
            <div className="relative ml-3">
              {/* Vertical tree line */}
              <div className="absolute bottom-5 left-[13px] top-5 w-px bg-[#252832]" />

              <div className="space-y-1">
                {children.map((node) => (
                  <RepositoryTreeItem
                    key={node.path}
                    node={node}
                    onOpen={openNode}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#252832] px-5 py-8 text-center text-[13px] text-[#6B7080]">
              This folder is empty.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface RepositoryTreeItemProps {
  node: RepositoryTreeNode;
  onOpen: (
    node: RepositoryTreeNode,
  ) => void;
}

function RepositoryTreeItem({
  node,
  onOpen,
}: RepositoryTreeItemProps) {
  const isFolder = node.type === "folder";

  const childCount =
    node.children?.length ?? 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      disabled={!isFolder}
      className={`group relative flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
        isFolder
          ? "cursor-pointer hover:bg-[#16181E]"
          : "cursor-default"
      }`}
    >
      {/* Tree connector */}
      <span className="absolute left-[-1px] top-1/2 h-px w-4 bg-[#252832]" />

      {/* Icon */}
      <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#252832] bg-[#0E0F12] text-[14px]">
        {isFolder ? "📁" : "📄"}
      </span>

      {/* Name */}
      <span
        className={`min-w-0 flex-1 truncate text-[13px] ${
          isFolder
            ? "font-medium text-[#EDEDEF]"
            : "font-mono text-[#B0B4BD]"
        }`}
      >
        {node.name}
      </span>

      {/* Folder metadata */}
      {isFolder && (
        <>
          <span className="shrink-0 font-mono text-[10px] text-[#6B7080]">
            {childCount}{" "}
            {childCount === 1
              ? "item"
              : "items"}
          </span>

          <span className="shrink-0 text-[13px] text-[#5C606B] transition group-hover:translate-x-0.5 group-hover:text-[#B0B4BD]">
            →
          </span>
        </>
      )}
    </button>
  );
}

export default RepositoryTree;