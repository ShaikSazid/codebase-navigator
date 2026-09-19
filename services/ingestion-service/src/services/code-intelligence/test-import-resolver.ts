import {
  resolveImports,
  buildResolvedRelationships,
} from "./import-resolver.js";

import type {
  CodeIndex,
} from "./indexer.types.js";

const index: CodeIndex = {
  repositoryId: "test-repository",

  files: [
    {
      path: "frontend/src/App.tsx",
      language: "tsx",
      lineCount: 10,
      imports: [
        {
          raw: 'import { Button } from "./components/Button";',
          moduleSpecifier: "./components/Button",
          importedNames: ["Button"],
          isWildcard: false,
        },
        {
          raw: 'import { add } from "./utils/math";',
          moduleSpecifier: "./utils/math",
          importedNames: ["add"],
          isWildcard: false,
        },
        {
          raw: 'import React from "react";',
          moduleSpecifier: "react",
          importedNames: [],
          isWildcard: false,
        },
      ],
    },

    {
      path: "frontend/src/components/Button.tsx",
      language: "tsx",
      lineCount: 20,
      imports: [],
    },

    {
      path: "frontend/src/utils/math.ts",
      language: "typescript",
      lineCount: 10,
      imports: [],
    },

    {
      path: "backend/app/main.py",
      language: "python",
      lineCount: 15,
      imports: [
        {
          raw: "from app.services import UserService",
          moduleSpecifier: "app.services",
          importedNames: ["UserService"],
          isWildcard: false,
        },
      ],
    },

    {
      path: "backend/app/services.py",
      language: "python",
      lineCount: 20,
      imports: [],
    },

    {
      path: "backend/app/utils.py",
      language: "python",
      lineCount: 10,
      imports: [],
    },
  ],

  symbols: [],

  relationships: [],
};

console.log("\n================ RESOLVED IMPORTS ================");

const resolvedImports = resolveImports(index);

console.dir(resolvedImports, {
  depth: null,
});

console.log("\n============== RESOLVED RELATIONSHIPS ==============");

const relationships =
  buildResolvedRelationships(
    resolvedImports,
  );

console.dir(relationships, {
  depth: null,
});