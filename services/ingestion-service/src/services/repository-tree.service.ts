export interface RepositoryTreeNode {
  name: string;
  path: string;
  type: "folder" | "file";
  children?: RepositoryTreeNode[];
}

export function buildRepositoryTree(
  files: Array<{
    path: string;
    content: string;
  }>,
  repositoryName: string,
): RepositoryTreeNode {
  const root: RepositoryTreeNode = {
    name: repositoryName,
    path: "",
    type: "folder",
    children: [],
  };

  for (const file of files) {
    addFileToTree(root, file.path);
  }

  return root;
}

function addFileToTree(
  root: RepositoryTreeNode,
  filePath: string,
): void {
  const parts = filePath
    .split("/")
    .filter(Boolean);

  let currentNode = root;
  let currentPath = "";

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    currentPath = currentPath
      ? `${currentPath}/${part}`
      : part;

    const isFile = i === parts.length - 1;

    if (!currentNode.children) {
      currentNode.children = [];
    }

    let child = currentNode.children.find(
      (node) => node.name === part,
    );

    if (!child) {
      child = {
        name: part,
        path: currentPath,
        type: isFile ? "file" : "folder",
        ...(isFile ? {} : { children: [] }),
      };

      currentNode.children.push(child);
    }

    currentNode = child;
  }
}