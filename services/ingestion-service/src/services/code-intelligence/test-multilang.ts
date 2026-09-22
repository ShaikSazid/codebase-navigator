import treeSitter from "@xberg-io/tree-sitter-language-pack";
import { detectLanguage } from "./language-registry.js";

const { process } = treeSitter;

const files = [
  {
    filePath: "src/example.js",
    source: `
import React from "react";
import { foo, bar as baz } from "./utils";
import * as config from "./config";

export function App() {
  return React.createElement("div");
}
`,
  },

  {
    filePath: "src/example.ts",
    source: `
import express from "express";
import { User } from "./models/user";
import * as utils from "../utils";

export class UserService {
  getUser(): User {
    return utils.getUser();
  }
}
`,
  },

  {
    filePath: "src/example.tsx",
    source: `
import React from "react";
import { Button } from "./components/Button";

export function App() {
  return <Button />;
}
`,
  },

  {
    filePath: "src/main.py",
    source: `
import os
from pathlib import Path
from app.services import UserService

class App:
    def run(self):
        return Path(".")
`,
  },

  {
    filePath: "src/main.go",
    source: `
package main

import (
  "fmt"
  "github.com/example/project/internal/config"
)

func main() {
  fmt.Println(config.Load())
}
`,
  },

  {
    filePath: "src/Main.java",
    source: `
package com.example;

import java.util.List;
import com.example.service.UserService;

public class Main {
    public void run() {
        UserService service = new UserService();
    }
}
`,
  },

  {
    filePath: "src/main.rs",
    source: `
use std::path::Path;
use crate::services::UserService;

fn main() {
    let _path = Path::new(".");
}
`,
  },

  {
    filePath: "src/main.cs",
    source: `
using System;
using MyApp.Services;

namespace MyApp {
    public class Program {
        public void Run() {
            Console.WriteLine("Hello");
        }
    }
}
`,
  },

  {
    filePath: "src/main.rb",
    source: `
require "json"
require_relative "./services/user_service"

class App
  def run
    JSON.parse("{}")
  end
end
`,
  },
];

for (const file of files) {
  console.log("\n========================================");
  console.log(file.filePath);
  console.log("========================================");

  const language = detectLanguage(file.filePath);

  if (!language) {
    console.log("Language: unsupported");
    continue;
  }

  console.log("\nDetected language:");
  console.log(language);

  try {
    const result = process(file.source, {
      language,
      structure: true,
      imports: true,
      exports: true,
      symbols: true,
      diagnostics: true,
    });

    console.log("\nParser language:");
    console.dir(result.language, { depth: null });

    console.log("\nImports:");
    console.dir(result.imports, { depth: null });

    console.log("\nStructure:");
    console.dir(result.structure, { depth: null });

    console.log("\nDiagnostics:");
    console.dir(result.diagnostics, { depth: null });
  } catch (error) {
    console.error("\nFAILED:");
    console.error(error);
  }
}