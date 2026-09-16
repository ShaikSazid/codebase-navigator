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
      for (const filePath of layer.files) {
        if (!repositoryFiles.has(filePath)) {
          throw new Error(
            `Mapper agent referenced a file that does not exist: ${filePath}`,
          );
        }
      }
    }

    return;
  }

  for (const file of result.rankedFiles ?? []) {
    if (!repositoryFiles.has(file.path)) {
      throw new Error(
        `Mapper agent referenced a file that does not exist: ${file.path}`,
      );
    }
  }
}