import type { ArchitectureMap } from "./mapper.types.js";
import type { RepoFileIndex } from "../../types/repo.js";

export function validateArchitectureMapFiles(
  result: ArchitectureMap,
  repository: RepoFileIndex,
): void {
  const repositoryFiles = new Set(
    repository.files.map((file) => file.path),
  );

  if (result.type === "structured") {
    for (const layer of result.layers ?? []) {
      const validFiles: string[] = [];

      for (const filePath of layer.files) {
        if (repositoryFiles.has(filePath)) {
          validFiles.push(filePath);
        } else {
          console.warn(
            `Mapper referenced a file that does not exist in the repository. Ignoring: ${filePath}`,
          );
        }
      }

      layer.files = validFiles;
    }

    return;
  }

  const validRankedFiles = [];

  for (const file of result.rankedFiles ?? []) {
    if (repositoryFiles.has(file.path)) {
      validRankedFiles.push(file);
    } else {
      console.warn(
        `Mapper referenced a file that does not exist in the repository. Ignoring: ${file.path}`,
      );
    }
  }

  result.rankedFiles = validRankedFiles;
}