#!/usr/bin/env node
/**
 * check-encoding.mjs
 *
 * Encoding guard for the repo's text files. Fails when any text file is
 * double-encoded UTF-8 ("mojibake": UTF-8 bytes misread as Windows-1252 and
 * re-saved — the signature artifact of PowerShell 5.1 Get-Content/Set-Content
 * round-trips on UTF-8 files) or carries a UTF-8 BOM.
 *
 * The suspect patterns are built at RUNTIME from code points and the CP1252
 * table — this source must never contain the mojibake sequences it detects,
 * or it would flag itself.
 *
 * Zero dependencies. Only runs when executed directly.
 *
 * Usage: node scripts/anti-slop/check-encoding.mjs [--root .]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEXT_EXT = /\.(md|mjs|json|ts|tsx|js|jsx|mts|cjs|txt|yml|yaml)$/;

/** Windows-1252 mappings for bytes 0x80-0x9F (the ones latin1 gets wrong). */
const CP1252_HIGH = [
  '\u20AC', '\u201A', '\u0192', '\u201E', '\u2026', '\u2020', '\u2021', '\u02C6',
  '\u2030', '\u0160', '\u2039', '\u0152', '\u017D', '\u2018', '\u2019',
  '\u201C', '\u201D', '\u2022', '\u2013', '\u2014', '\u02DC', '\u2122',
  '\u0161', '\u203A', '\u0153', '\u017E', '\u0178',
];

// Suspect sequences, built from code points so this source file stays clean:
//   E2 + high-char  -> UTF-8 lead byte E2 (—, “, ”, …, box-drawing) misread
//   C3 + letter     -> UTF-8 lead byte C3 (é, è, ñ, …) misread
//   C2 + high-char  -> UTF-8 lead byte C2 (¡, £, ©, …) misread
const E2 = '\u00E2';
const C3 = '\u00C3';
const C2 = '\u00C2';
const SUSPECT_RE = new RegExp(
  `${E2}[${CP1252_HIGH.join('')}]` +
  `|${C3}[a-z]` +
  `|${C2}[${CP1252_HIGH.join('')}]`,
);

/** True when text carries the classic UTF-8-as-CP1252 mojibake signatures. */
export function isSuspectMojibake(text) {
  return SUSPECT_RE.test(text);
}

/**
 * Simulate the PowerShell failure for tests: decode UTF-8 bytes as CP1252.
 * (PS 5.1 Get-Content without -Encoding does exactly this.)
 */
export function utf8ToCp1252String(text) {
  return Buffer.from(text, 'utf8').toString('latin1')
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x80 && code <= 0x9F ? CP1252_HIGH[code - 0x80] : ch;
    })
    .join('');
}

function cp1252Reverse(ch) {
  const idx = CP1252_HIGH.indexOf(ch);
  if (idx !== -1) return idx + 0x80;
  const code = ch.charCodeAt(0);
  if (code <= 0xFF) return code;
  return null;
}

/**
 * Reverse UTF-8-as-CP1252 double encoding. Returns the repaired text, or
 * null when any character cannot be reversed in a single cp1252 byte
 * (mixed-state files need manual fixing).
 */
export function repairDoubleEncodedUtf8(text) {
  const bytes = [];
  for (const ch of text) {
    const b = cp1252Reverse(ch);
    if (b === null) return null;
    bytes.push(b);
  }
  return Buffer.from(bytes).toString('utf8');
}

/** True when the decoded text starts with a UTF-8 BOM (U+FEFF). */
export function hasUtf8Bom(text) {
  return text.charCodeAt(0) === 0xFEFF;
}

function textFiles(root) {
  const files = [];
  const skip = new Set(['node_modules', '.git', 'data', '.next', 'dist']);
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') && e.name !== '.github') continue;
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (statSync(full).isDirectory()) walk(full);
      else if (TEXT_EXT.test(e.name)) {
        files.push({ full, rel: path.relative(root, full).split(path.sep).join('/') });
      }
    }
  })(root);
  return files;
}

function main() {
  const root = process.cwd();
  const files = textFiles(root);
  let broken = 0;
  for (const file of files) {
    const src = readFileSync(file.full, 'utf8');
    if (hasUtf8Bom(src)) {
      console.log(`BROKEN (bom): ${file.rel}`);
      broken++;
      continue;
    }
    if (!isSuspectMojibake(src)) continue;
    const repaired = repairDoubleEncodedUtf8(src);
    if (repaired !== null && !isSuspectMojibake(repaired)) {
      console.log(`BROKEN (mojibake, repairable): ${file.rel}`);
    } else {
      console.log(`BROKEN (mojibake, mixed-state): ${file.rel}`);
    }
    broken++;
  }
  if (broken === 0) {
    console.log(`[ok] Encoding check passed (${files.length} text file(s), no BOM, no double-encoded UTF-8).`);
    process.exit(0);
  }
  console.error(
    `\n[x] Encoding check FAILED (${broken} file(s)).\n` +
    '    Cause: PowerShell 5.1 Get-Content reads UTF-8 as ANSI; a Get-Content/Set-Content\n' +
    '    round-trip double-encodes every non-ASCII character. Never round-trip repo text\n' +
    '    files through PowerShell - edit with tools, or read/write as explicit UTF-8.\n' +
    '    Repairable files: reverse with the cp1252->UTF-8 transform (see repairDoubleEncodedUtf8).'
  );
  process.exit(1);
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) main();
