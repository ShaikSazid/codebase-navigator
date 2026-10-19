import { useMemo, useState } from "react";
import { Check, ChevronRight, Copy, FileCode2, PanelRightClose, Sparkles } from "lucide-react";
import type { RepositoryFile } from "../lib/repository.api";

/* -------------------------------------------------------------------------- */
/*  Lightweight syntax highlighter (no dependencies)                           */
/* -------------------------------------------------------------------------- */

type TokenKind = "kw" | "str" | "num" | "com" | "fn" | "type" | "const" | "prop" | "punct" | "plain";

interface Token {
  text: string;
  kind: TokenKind;
}

interface LangSpec {
  comment?: string;
  string?: string;
  number?: string;
  word: string;
  keywords: Set<string>;
  constants: Set<string>;
  types?: boolean;
  jsonKeys?: boolean;
  cssProps?: boolean;
}

const set = (words: string) => new Set(words.split(/\s+/).filter(Boolean));

const JS_KEYWORDS = set(`
  import export from default as const let var function return if else for while do switch case break continue
  new class extends super this typeof instanceof in of await async yield try catch finally throw delete void
  interface type enum implements public private protected readonly static abstract declare namespace keyof satisfies
`);

const CLIKE_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  ...set(`
    package func struct impl trait fn mut pub use mod match where defer go chan select map range fallthrough
    int float double char bool string long short unsigned signed auto extern inline sizeof typedef union
    final synchronized throws volatile transient override virtual namespace using template typename
    val fun object companion when is
  `),
]);

const PY_KEYWORDS = set(`
  def class return if elif else for while in not and or is import from as with try except finally raise
  pass break continue lambda yield global nonlocal assert del async await self cls match case
`);

const SHELL_KEYWORDS = set(`if then else elif fi for while do done case esac function in export local return echo cd`);

const COMMON_CONSTANTS = set(`true false null undefined NaN Infinity None True False nil`);

const JS_STRINGS = "\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\[\\s\\S]|[^`\\\\])*`";
const NUMBER = "\\b0x[0-9a-fA-F]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b";

const JS_SPEC: LangSpec = {
  comment: "\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/",
  string: JS_STRINGS,
  number: NUMBER,
  word: "[A-Za-z_$][\\w$]*",
  keywords: JS_KEYWORDS,
  constants: COMMON_CONSTANTS,
  types: true,
};

const CLIKE_SPEC: LangSpec = { ...JS_SPEC, keywords: CLIKE_KEYWORDS };

const PY_SPEC: LangSpec = {
  comment: "#[^\\n]*",
  string: "\"\"\"[\\s\\S]*?\"\"\"|'''[\\s\\S]*?'''|\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'",
  number: NUMBER,
  word: "[A-Za-z_][\\w]*",
  keywords: PY_KEYWORDS,
  constants: COMMON_CONSTANTS,
  types: true,
};

const JSON_SPEC: LangSpec = {
  string: "\"(?:\\\\.|[^\"\\\\\\n])*\"",
  number: "-?\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b",
  word: "[A-Za-z_][\\w]*",
  keywords: new Set(),
  constants: COMMON_CONSTANTS,
  jsonKeys: true,
};

const CSS_SPEC: LangSpec = {
  comment: "\\/\\*[\\s\\S]*?\\*\\/",
  string: "\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'",
  number: "#[0-9a-fA-F]{3,8}\\b|-?\\d*\\.?\\d+(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?",
  word: "-?[A-Za-z_][\\w-]*",
  keywords: set(`@media @import @keyframes @font-face @layer @apply @tailwind important`),
  constants: set(`none auto inherit initial unset`),
  cssProps: true,
};

const HASH_SPEC: LangSpec = {
  comment: "#[^\\n]*",
  string: "\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'",
  number: NUMBER,
  word: "[A-Za-z_][\\w-]*",
  keywords: SHELL_KEYWORDS,
  constants: COMMON_CONSTANTS,
};

interface Language {
  label: string;
  spec: LangSpec | null;
}

const LANGUAGES: Record<string, Language> = {
  ts: { label: "TypeScript", spec: JS_SPEC },
  tsx: { label: "TSX", spec: JS_SPEC },
  js: { label: "JavaScript", spec: JS_SPEC },
  jsx: { label: "JSX", spec: JS_SPEC },
  mjs: { label: "JavaScript", spec: JS_SPEC },
  cjs: { label: "JavaScript", spec: JS_SPEC },
  py: { label: "Python", spec: PY_SPEC },
  json: { label: "JSON", spec: JSON_SPEC },
  css: { label: "CSS", spec: CSS_SPEC },
  scss: { label: "SCSS", spec: CSS_SPEC },
  go: { label: "Go", spec: CLIKE_SPEC },
  java: { label: "Java", spec: CLIKE_SPEC },
  kt: { label: "Kotlin", spec: CLIKE_SPEC },
  rs: { label: "Rust", spec: CLIKE_SPEC },
  c: { label: "C", spec: CLIKE_SPEC },
  h: { label: "C Header", spec: CLIKE_SPEC },
  cpp: { label: "C++", spec: CLIKE_SPEC },
  cs: { label: "C#", spec: CLIKE_SPEC },
  swift: { label: "Swift", spec: CLIKE_SPEC },
  sh: { label: "Shell", spec: HASH_SPEC },
  bash: { label: "Shell", spec: HASH_SPEC },
  yml: { label: "YAML", spec: HASH_SPEC },
  yaml: { label: "YAML", spec: HASH_SPEC },
  toml: { label: "TOML", spec: HASH_SPEC },
  md: { label: "Markdown", spec: null },
  html: { label: "HTML", spec: null },
  txt: { label: "Text", spec: null },
};

function getLanguage(path: string): Language {
  const name = path.split("/").pop() ?? path;
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return LANGUAGES[ext] ?? { label: ext ? ext.toUpperCase() : "Plain text", spec: null };
}

function buildRegex(spec: LangSpec): RegExp {
  const never = "(?!)";
  return new RegExp(
    [
      `(${spec.comment ?? never})`,
      `(${spec.string ?? never})`,
      `(${spec.number ?? never})`,
      `(${spec.word})`,
      `(\\s+)`,
      `([\\s\\S])`,
    ].join("|"),
    "g",
  );
}

function nextNonSpace(source: string, from: number): string {
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r") return ch;
  }
  return "";
}

const PUNCT = /[{}()[\];,.:<>=+\-*/%!&|?^~@]/;

/** Tokenizes the whole file (so multi-line comments/strings work) and returns tokens grouped per line. */
function highlight(source: string, spec: LangSpec | null): Token[][] {
  const lines: Token[][] = [[]];

  const push = (text: string, kind: TokenKind) => {
    const parts = text.split("\n");
    parts.forEach((part, index) => {
      if (index > 0) lines.push([]);
      if (!part) return;
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last && last.kind === kind) last.text += part;
      else line.push({ text: part, kind });
    });
  };

  if (!spec) {
    push(source, "plain");
    return lines;
  }

  const regex = buildRegex(spec);
  let braceDepth = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const [full, comment, str, num, word, space, other] = match;
    const end = match.index + full.length;

    if (comment !== undefined) {
      push(comment, "com");
    } else if (str !== undefined) {
      const isKey = spec.jsonKeys && nextNonSpace(source, end) === ":";
      push(str, isKey ? "prop" : "str");
    } else if (num !== undefined) {
      push(num, "num");
    } else if (word !== undefined) {
      let kind: TokenKind = "plain";
      if (spec.keywords.has(word)) kind = "kw";
      else if (spec.constants.has(word)) kind = "const";
      else if (spec.cssProps && braceDepth > 0 && nextNonSpace(source, end) === ":") kind = "prop";
      else if (!spec.cssProps && nextNonSpace(source, end) === "(") kind = "fn";
      else if (spec.types && /^[A-Z][A-Za-z0-9]*$/.test(word)) kind = "type";
      push(word, kind);
    } else if (space !== undefined) {
      push(space, "plain");
    } else if (other !== undefined) {
      if (other === "{") braceDepth += 1;
      if (other === "}") braceDepth = Math.max(0, braceDepth - 1);
      push(other, PUNCT.test(other) ? "punct" : "plain");
    }

    if (full.length === 0) regex.lastIndex += 1;
  }

  return lines;
}

const TOKEN_CLASS: Record<TokenKind, string> = {
  kw: "text-[#E8C48A]",
  str: "text-[#A3B88C]",
  num: "text-[#E0A87A]",
  com: "italic text-[#5F5C56]",
  fn: "text-[#9DB7D5]",
  type: "text-[#C4A3C7]",
  const: "text-[#E0A87A]",
  prop: "text-[#9DB7D5]",
  punct: "text-[#8A8780]",
  plain: "text-[#C2C0B8]",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

interface SourceViewerProps {
  file: RepositoryFile | null;
  isLoading: boolean;
  isExplanationOpen: boolean;
  onToggleExplanation: () => void;
}

const SKELETON_WIDTHS = [38, 62, 48, 74, 30, 56, 66, 42, 70, 34, 52, 60];

export default function SourceViewer({
  file,
  isLoading,
  isExplanationOpen,
  onToggleExplanation,
}: SourceViewerProps) {
  const [copied, setCopied] = useState(false);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);

  const language = useMemo(() => (file ? getLanguage(file.path) : null), [file]);

  const lines = useMemo(() => {
    if (!file || !language) return [];
    const normalized = file.content.replace(/\r\n?/g, "\n");
    return highlight(normalized, language.spec);
  }, [file, language]);

  const sizeLabel = useMemo(
    () => (file ? formatBytes(new Blob([file.content]).size) : ""),
    [file],
  );

  const handleCopy = async () => {
    if (!file) return;
    try {
      await navigator.clipboard.writeText(file.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  /* Loading */
  if (isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center gap-3 border-b border-[#1E1E21] bg-[#111113]/80 px-4 py-3.5">
          <div className="cn-sheen h-3 w-48 rounded-full" />
        </div>
        <div className="space-y-3 p-6">
          {SKELETON_WIDTHS.map((width, index) => (
            <div key={index} className="flex items-center gap-5">
              <div className="cn-sheen h-2.5 w-5 rounded-full" />
              <div className="cn-sheen h-2.5 rounded-full" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* Empty */
  if (!file || !language) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#232326] bg-[#141417]">
          <FileCode2 className="h-5 w-5 text-[#726E67]" />
        </div>
        <p className="font-display mt-5 text-[28px] leading-none text-[#EAE7E0]">Select a file</p>
        <p className="mt-2 max-w-[280px] text-[13px] leading-5 text-[#9E9A92]">
          Pick a file from the explorer to read its source and get AI insights.
        </p>
      </div>
    );
  }

  const segments = file.path.split("/");
  const gutterWidth = `${Math.max(String(lines.length).length, 2) + 3}ch`;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#1E1E21] bg-[#111113]/80 px-4 py-2.5 backdrop-blur">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1 font-mono text-[12px]" title={file.path}>
            {segments.map((segment, index) => (
              <span key={index} className="flex min-w-0 items-center gap-1">
                <span
                  className={
                    index === segments.length - 1
                      ? "truncate font-medium text-[#EAE7E0]"
                      : "shrink-0 text-[#726E67]"
                  }
                >
                  {segment}
                </span>
                {index < segments.length - 1 && <ChevronRight className="h-3 w-3 shrink-0 text-[#454340]" />}
              </span>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10.5px] text-[#55534F]">
            <span className="text-[#9E9A92]">{language.label}</span>
            <span>·</span>
            <span>{lines.length} lines</span>
            <span>·</span>
            <span>{sizeLabel}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy source"
            className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] text-[#9E9A92] transition-colors hover:bg-[#1B1B1E] hover:text-[#EAE7E0]"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-[#D4A359]" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            type="button"
            onClick={onToggleExplanation}
            className={`flex h-8 items-center gap-2 rounded-lg border px-3.5 text-[12px] font-medium transition-all duration-200 ${
              isExplanationOpen
                ? "border-[#38373B] bg-[#222226] text-[#EAE7E0]"
                : "border-[#D4A359]/40 bg-[#D4A359]/10 text-[#E8C48A] hover:bg-[#D4A359]/20"
            }`}
          >
            {isExplanationOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span>{isExplanationOpen ? "Hide AI" : "Explain file"}</span>
          </button>
        </div>
      </div>

      {/* Code */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto bg-[#0E0E10]">
        <div className="min-w-max py-3 font-mono text-[12.5px] leading-[22px]" style={{ tabSize: 2 }}>
          {lines.map((tokens, index) => {
            const lineNumber = index + 1;
            const isSelected = selectedLine === lineNumber;
            return (
              <div
                key={index}
                onClick={() => setSelectedLine(isSelected ? null : lineNumber)}
                className={`group flex cursor-text border-l-2 transition-colors ${
                  isSelected
                    ? "border-[#D4A359] bg-[#D4A359]/[0.08]"
                    : "border-transparent hover:bg-white/[0.025]"
                }`}
              >
                <span
                  className={`sticky left-0 z-10 shrink-0 select-none bg-[#0E0E10] pr-4 text-right transition-colors ${
                    isSelected ? "text-[#D4A359]" : "text-[#4A4845] group-hover:text-[#726E67]"
                  }`}
                  style={{ width: gutterWidth }}
                >
                  {lineNumber}
                </span>
                <span className="whitespace-pre pl-3 pr-8">
                  {tokens.length === 0
                    ? " "
                    : tokens.map((token, tokenIndex) => (
                        <span key={tokenIndex} className={TOKEN_CLASS[token.kind]}>
                          {token.text}
                        </span>
                      ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}