import type { RepoFileIndex } from "../../types/repo.js";

export interface LayerGroup {
  name: string;
  description: string;
  files: string[];
}

export interface RankedFile {
  path: string;
  importanceScore: number;
  reason: string;
}

export interface ArchitectureMap {
  type: "structured" | "importance-ranked";
  layers?: LayerGroup[];
  rankedFiles?: RankedFile[];
  summary: string;
}

export interface MapperInput {
  repository: RepoFileIndex;
}