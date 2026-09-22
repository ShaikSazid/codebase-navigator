import {
  indexRepositoryFiles,
} from "./code-indexer.service.js";

const files = [
  {
    filePath: "backend/app/main.py",
    content: `
import os
from pathlib import Path

class RepositoryAnalyzer:
    def __init__(self, root):
        self.root = root

    def analyze(self):
        print("Analyzing:", self.root)

def main():
    analyzer = RepositoryAnalyzer(Path("."))
    analyzer.analyze()

if __name__ == "__main__":
    main()
`,
  },
  {
    filePath: "frontend/src/utils/math.js",
    content: `
export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}
`,
  },
  {
    filePath: "frontend/src/App.tsx",
    content: `
import { add } from "./utils/math";

export class App {
  render() {
    return add(10, 20);
  }
}
`,
  },
];

const repositoryId = "test-repository";

const index = indexRepositoryFiles(
  repositoryId,
  files,
);

console.log("\n================ FILES ================");
console.dir(index.files, { depth: null });

console.log("\n================ SYMBOLS ================");
console.dir(index.symbols, { depth: null });

console.log("\n============== RELATIONSHIPS ==============");
console.dir(index.relationships, { depth: null });