import treeSitter from "@xberg-io/tree-sitter-language-pack";

import {
  normalizeImports,
} from "./import-normalizer.js";

const { process } = treeSitter;

const files = [
  {
    filePath: "src/example.js",
    language: "javascript",
    source: `
import React from "react";
import { foo, bar as baz } from "./utils";
import * as config from "./config";
`,
  },

  {
    filePath: "src/example.ts",
    language: "typescript",
    source: `
import express from "express";
import { User } from "./models/user";
import * as utils from "../utils";
`,
  },

  {
    filePath: "src/example.tsx",
    language: "tsx",
    source: `
import React from "react";
import { Button } from "./components/Button";
`,
  },

  {
    filePath: "src/main.py",
    language: "python",
    source: `
import os
from pathlib import Path
from app.services import UserService
`,
  },

  {
    filePath: "src/main.go",
    language: "go",
    source: `
package main

import (
  "fmt"
  "github.com/example/project/internal/config"
)
`,
  },

  {
    filePath: "src/Main.java",
    language: "java",
    source: `
package com.example;

import java.util.List;
import com.example.service.UserService;
`,
  },

  {
    filePath: "src/main.rs",
    language: "rust",
    source: `
use std::path::Path;
use crate::services::UserService;
`,
  },
];

for (const file of files) {
  console.log("\n========================================");
  console.log(file.filePath);
  console.log("========================================");

  const result = process(file.source, {
    language: file.language,
    imports: true,
  });

  const normalized =
    normalizeImports(
      file.language,
      result.imports ?? [],
    );

  console.dir(normalized, {
    depth: null,
  });
}