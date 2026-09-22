import type { RepositoryRelationship } from "../repository-context.service.js";

export type NavigationOperation =
  | "flow"
  | "usage"
  | "dependency"
  | "data"
  | "configuration"
  | "location"
  | "behavior"
  | "unknown";

export interface QuestionModel {
  raw: string;
  normalized: string;
  terms: string[];
  phrases: string[];
  operation: NavigationOperation;
}

export interface GraphNode {
  id: string;
  filePath: string;
  symbol?: string;
  kind?: string;
  startLine: number;
  endLine: number;
}

export interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  relationship: RepositoryRelationship;
}

export interface CandidateNode {
  node: GraphNode;
  score: number;
  reasons: string[];
}

export interface NavigationPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  score: number;
}

export interface NavigationStep {
  order: number;
  filePath: string;
  symbol?: string;
  kind?: string;
  startLine: number;
  endLine: number;
  relationshipFromPrevious?: string;
  relationshipEvidence?: {
    filePath: string;
    startLine: number;
    endLine: number;
  };
  explanation: string;
}

export interface NavigationBranch {
  fromOrder: number;
  filePath: string;
  symbol?: string;
  kind?: string;
  startLine: number;
  endLine: number;
  relationship: string;
  explanation: string;
}

export interface NavigationResult {
  question: string;
  entryPoint: NavigationStep | null;
  steps: NavigationStep[];
  branches: NavigationBranch[];
  answer: string;
}