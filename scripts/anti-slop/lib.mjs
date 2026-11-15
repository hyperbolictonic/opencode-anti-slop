/**
 * lib.mjs — shared helpers for the anti-slop gate scripts.
 *
 * Zero dependencies (Node >= 18, ESM). Each gate script imports from here so
 * scanning/classification logic exists in exactly one place. Keep this module
 * free of any script-specific behavior (no args parsing, no I/O decisions).
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';

export const EXCLUDE_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', '.next', '.turbo',
  'coverage', 'storybook-static', '__tests__', '__mocks__',
]);
export const IGNORE_FILE = /(\.test|\.spec|\.stories|\.d)\.[tj]sx?$/;

/** Generated files that must never be gated (sizes/counts are machine-owned). */
export const GENERATED_FILE = /(^|\/)(payload-types|next-env)\.d?ts$/;

export function isGenerated(relPath) {
  return GENERATED_FILE.test(relPath);
}
export const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts']);

/** Recursively list source files under `dir`, as { full, rel } with '/'-separated rel paths. */
export function walk(dir, base) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || EXCLUDE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full).split(path.sep).join('/');
    if (entry.isDirectory()) files.push(...walk(full, base));
    else if (SOURCE_EXT.has(path.extname(entry.name)) && !IGNORE_FILE.test(entry.name) && !isGenerated(rel)) {
      files.push({ full, rel });
    }
  }
  return files;
}

/**
 * Remove comments and string contents so brace/regex analysis is reliable.
 * Newlines (including those inside strings) are preserved, so line numbers
 * computed on the output match the original source.
 */
export function stripNoise(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < n && src[i] !== quote) {
        if (src[i] === '\\') i++;
        if (src[i] === '\n') out += '\n';
        i++;
      }
      i++; // closing quote
      out += '""';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/**
 * Tokenize comment/string-stripped source into normalized tokens:
 * strings -> `<str>`, numbers -> `<num>`, identifiers/symbols stay literal.
 * Returns [{ t, line }] with 1-based line numbers.
 */
const TOKEN_RE =
  /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`|[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|\S/g;

export function tokenize(stripped) {
  const tokens = [];
  for (const m of stripped.matchAll(TOKEN_RE)) {
    let nl = 0;
    for (let k = 0; k < m.index; k++) if (m.input[k] === '\n') nl++;
    const raw = m[0];
    const t = raw[0] === '"' || raw[0] === "'" || raw[0] === '`' ? '<str>'
      : /^\d/.test(raw) ? '<num>'
      : raw;
    tokens.push({ t, line: 1 + nl });
  }
  return tokens;
}

/** 1-based line number of char index `idx` within comment/string-stripped source. */
export function lineOf(stripped, idx) {
  let line = 1;
  for (let i = 0; i < idx && i < stripped.length; i++) {
    if (stripped[i] === '\n') line++;
  }
  return line;
}
