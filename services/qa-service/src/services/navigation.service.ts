import {
  getRepositoryIndex,
} from "./repository-context.service.js";

import {
  searchCode,
} from "./vector-search.service.js";

import {
  analyzeQuestion,
} from "./navigation/question-analyzer.js";

import {
  findNavigationCandidates,
} from "./navigation/candidate-finder.js";

import {
  buildNavigationGraph,
  collectNavigationBranches,
  findNavigationPath,
} from "./navigation/graph-traversal.js";

import {
  buildNavigationBranches,
  buildNavigationSteps,
  buildNavigationSummary,
} from "./navigation/navigation-explainer.js";

import type {
  NavigationResult,
} from "./navigation/navigation.types.js";

export async function navigateRepository(
  question: string,
  repositoryId: string,
): Promise<NavigationResult> {
  console.log("[NAV] start");
  console.log("[NAV] question:", question);
  console.log("[NAV] repositoryId:", repositoryId);

  console.log("[NAV] repository index:start");

  const repositoryIndex =
    await getRepositoryIndex(
      repositoryId,
    );

  console.log(
    "[NAV] repository index:done",
    repositoryIndex
      ? {
          files:
            repositoryIndex.files.length,
          dependencies:
            repositoryIndex.dependencyEdges.length,
          relationships:
            repositoryIndex.relationships.length,
          dataModels:
            repositoryIndex.dataModels?.length ??
            0,
        }
      : null,
  );

  if (!repositoryIndex) {
    console.log(
      "[NAV] repository index:not found",
    );

    throw new Error(
      "Repository index not found",
    );
  }

  console.log(
    "[NAV] question analysis:start",
  );

  const questionModel =
    analyzeQuestion(
      question,
    );

  console.log(
    "[NAV] question analysis:done",
    questionModel,
  );

  console.log(
    "[NAV] code search:start",
  );

  const searchResults =
    await searchCode(
      question,
      repositoryId,
      20,
    );

  console.log(
    "[NAV] code search:done",
    {
      count:
        searchResults.length,
      results:
        searchResults.map(
          (result) =>
            `${result.filePath}:${result.startLine}-${result.endLine}`,
        ),
    },
  );

  console.log(
    "[NAV] candidate finding:start",
  );

  const candidates =
    findNavigationCandidates(
      repositoryIndex,
      questionModel,
      searchResults,
    );

  console.log(
    "[NAV] candidate finding:done",
    {
      count:
        candidates.length,
      candidates:
        candidates.slice(
          0,
          10,
        ),
    },
  );

  if (
    candidates.length ===
      0 ||
    candidates[0].score < 8
  ) {
    console.log(
      "[NAV] no suitable candidates",
      {
        count:
          candidates.length,
        topScore:
          candidates[0]?.score ??
          null,
      },
    );

    return {
      question,
      entryPoint: null,
      steps: [],
      branches: [],
      answer:
        buildNavigationSummary(
          question,
          [],
          [],
        ),
    };
  }

  console.log(
    "[NAV] graph building:start",
  );

  const graph =
    buildNavigationGraph(
      repositoryIndex,
    );

  console.log(
    "[NAV] graph building:done",
    {
      edges:
        graph.length,
      graph:
        graph.slice(
          0,
          20,
        ),
    },
  );

  console.log(
    "[NAV] path finding:start",
  );

  const path =
    findNavigationPath(
      graph,
      candidates,
      questionModel,
    );

  console.log(
    "[NAV] path finding:done",
    path
      ? {
          nodes:
            path.nodes.length,
          edges:
            path.edges.length,
          path,
        }
      : null,
  );

  if (
    !path ||
    path.nodes.length === 0
  ) {
    console.log(
      "[NAV] no navigation path found",
    );

    return {
      question,
      entryPoint: null,
      steps: [],
      branches: [],
      answer:
        buildNavigationSummary(
          question,
          [],
          [],
        ),
    };
  }

  console.log(
    "[NAV] step building:start",
  );

  const steps =
    buildNavigationSteps(
      path,
      questionModel,
    );

  console.log(
    "[NAV] step building:done",
    {
      count:
        steps.length,
      steps,
    },
  );

  console.log(
    "[NAV] branch collection:start",
  );

  const branchEdges =
    collectNavigationBranches(
      path,
      graph,
      questionModel,
    );

  console.log(
    "[NAV] branch collection:done",
    {
      count:
        branchEdges.length,
      branchEdges,
    },
  );

  console.log(
    "[NAV] branch building:start",
  );

  const branches =
    buildNavigationBranches(
      branchEdges,
      steps,
      questionModel,
    );

  console.log(
    "[NAV] branch building:done",
    {
      count:
        branches.length,
      branches,
    },
  );

  console.log(
    "[NAV] summary building:start",
  );

  const answer =
    buildNavigationSummary(
      question,
      steps,
      branches,
    );

  console.log(
    "[NAV] summary building:done",
    answer,
  );

  console.log(
    "[NAV] complete",
  );

  return {
    question,
    entryPoint:
      steps[0] ?? null,
    steps,
    branches,
    answer,
  };
}