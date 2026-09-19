import treeSitter from "@xberg-io/tree-sitter-language-pack";

const { process } = treeSitter;

const source = `
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
`;

const result = process(source, {
  language: "python",
});

console.log("=== LANGUAGE ===");
console.dir(result.language, { depth: null });

console.log("\n=== STRUCTURE ===");
console.dir(result.structure, { depth: null });

console.log("\n=== IMPORTS ===");
console.dir(result.imports, { depth: null });

console.log("\n=== EXPORTS ===");
console.dir(result.exports, { depth: null });

console.log("\n=== SYMBOLS ===");
console.dir(result.symbols, { depth: null });

console.log("\n=== METRICS ===");
console.dir(result.metrics, { depth: null });