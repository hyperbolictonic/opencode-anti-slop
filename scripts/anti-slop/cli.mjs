/**
 * cli.mjs â€” shared CLI/config plumbing for the anti-slop gate scripts.
 *
 * Zero dependencies (Node >= 18, ESM). Source-scanning helpers live in lib.mjs;
 * this module handles flag parsing, per-repo config loading, and path-to-file
 * resolution. Keep it free of scanning logic.
 */

import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { walk, SOURCE_EXT, IGNORE_FILE } from './lib.mjs';

// --- CLI parsing ---------------------------------------------------------------

/**
 * Parse CLI flags uniformly across gate scripts.
 *
 * spec maps flag -> type: 'string' | 'number' | 'flag' (boolean, no value).
 * argv starts after the script path. Unknown flags and bare positional words
 * land in `positionals`; each script decides whether positionals are an error
 * or file paths.
 *
 * Returns { values: Record<flag, string|number|true>, positionals: string[] }.
 */
export function parseFlags(argv, spec) {
  const values = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    const type = spec[s];
    if (!type) {
      positionals.push(s);
      continue;
    }
    if (type === 'flag') {
      values[s] = true;
      continue;
    }
    const raw = argv[++i];
    if (raw === undefined) {
      throw new Error(`Missing value for ${s}`);
    }
    const v = type === 'number' ? Number(raw) : raw;
    if (type === 'number' && Number.isNaN(v)) {
      throw new Error(`${s} expects a number, got: ${raw}`);
    }
    values[s] = v;
  }
  return { values, positionals };
}

/**
 * Common gate bootstrap: handle -h/--help with `usage`, parse flags per `spec`,
 * and merge flag values over `defaults` (config-supplied). Flag names are
 * camelCased into arg keys: --min-tokens -> args.minTokens, --report-only ->
 * args.reportOnly (flags become true/false).
 *
 * Returns { args, positionals }. Never returns on -h (exits 0) or a parse
 * error (exits 1).
 */
export function bootstrapGate(argv, { usage, spec, defaults }) {
  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(usage);
    process.exit(0);
  }
  let parsed;
  try {
    parsed = parseFlags(argv, spec);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const args = { ...defaults };
  for (const [flag, type] of Object.entries(spec)) {
    const key = flag.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    args[key] = type === 'flag'
      ? parsed.values[flag] === true
      : (parsed.values[flag] ?? defaults[key]);
  }
  return { args, positionals: parsed.positionals };
}

/**
 * Resolve explicit path arguments (files or directories) into { full, rel }
 * source entries, applying the same filters as walk(). Exits 1 on a missing
 * path. Used by gate scripts in git-hook staged-file mode.
 */
export function collectPathFiles(paths) {
  const files = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    if (!existsSync(abs)) {
      console.error(`Path not found: ${p}`);
      process.exit(1);
    }
    if (statSync(abs).isDirectory()) {
      files.push(...walk(abs, abs));
    } else if (SOURCE_EXT.has(path.extname(abs)) && !IGNORE_FILE.test(abs)) {
      files.push({ full: abs, rel: path.relative(process.cwd(), abs).split(path.sep).join('/') });
    }
  }
  return files;
}

/**
 * Resolve the scan root given to a gate (--src): accepts a directory (walked)
 * or a single file. Exits 1 when the path does not exist.
 */
export function resolveScanTarget(src) {
  const abs = path.resolve(src);
  if (!existsSync(abs)) {
    console.error(`Source directory not found: ${abs}`);
    process.exit(1);
  }
  if (statSync(abs).isFile()) {
    return collectPathFiles([src]);
  }
  return walk(abs, abs);
}

/**
 * bootstrapGate plus the standard positional validation most gates share.
 * Pass allowPositionals: true for gates that accept file-path arguments
 * (git-hook staged mode).
 */
export function gateArgs({ argv, usage, spec, defaults, allowPositionals = false }) {
  const { args, positionals } = bootstrapGate(argv, { usage, spec, defaults });
  if (!allowPositionals && positionals.length > 0) {
    console.error(`Unexpected arguments: ${positionals.join(' ')} (this script takes flags only)`);
    process.exit(1);
  }
  return { args, positionals };
}

// --- per-repo config ----------------------------------------------------------

/**
 * Reads `anti-slop.config.json` from process.cwd() (repo root), returning the
 * parsed object or {} when absent/invalid (with a warning on invalid).
 * Scripts merge: defaults < config file < CLI flags.
 *
 * Shape:
 * {
 *   "duplicates": { "src": "src", "minTokens": 50, "threshold": 3,
 *                   "ignore": ["collections/**"] },
 *   "modularity": { "src": "src", "maxFileLines": 300, "maxFunctionLines": 80,
 *                   "maxClassMethods": 10 },
 *   "docs":       { "src": "src", "ignorePaths": ["app/(payload)/**"],
 *                   "ignoreExports": ["metadata", "dynamic"] },
 *   "imports":    { "src": "src", "deny": [{ "from": "src/domain/**",
 *                   "forbid": "src/infra/**" }] }
 * }
 *
 * `ignore` (duplicates) and `ignorePaths` (docs) exclude framework-idiomatic
 * declarative files whose repetition is shape, not logic.
 */
export function loadConfig() {
  const file = path.join(process.cwd(), 'anti-slop.config.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[warn] Could not parse anti-slop.config.json (${err.message}); using defaults.`);
    return {};
  }
}

/** Convert a glob (`**`, `*`, `?`) into a RegExp tested against '/'-separated rel paths. */
export function globToRegex(glob) {
  let pattern = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        pattern += '[\\s\\S]*';
        i++;
      } else {
        pattern += '[^/]*';
      }
    } else if (c === '?') {
      pattern += '[^/]';
    } else {
      pattern += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${pattern}$`);
}

/** True when relPath matches any ignore glob. */
export function matchesAnyGlob(relPath, globs) {
  return globs.length > 0 && globs.some((g) => globToRegex(g).test(relPath));
}
