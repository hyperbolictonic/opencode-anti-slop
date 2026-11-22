/**
 * Release guard: everything the installer loads at runtime must be in the
 * published tarball. `files` in package.json is an allowlist, and a missing
 * entry fails only after publish — v0.1.7 through v0.1.12 shipped without
 * `presets/`, so `npx opencode-anti-slop` died on
 * `import './presets/resolve.mjs'` for every consumer while every local test
 * passed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]$/, '');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/** Paths install.mjs (and the presets it resolves) must find after install. */
const RUNTIME_FILES = [
  'install.mjs',
  'presets/resolve.mjs',
  'presets/default/manifest.json',
  'templates/anti-slop-ci.yml',
  '.opencode/skills/modular-architecture/SKILL.md',
  '.opencode/commands/deslop.md',
  '.opencode/agents/deslop-reviewer.md',
  'scripts/anti-slop/config.mjs',
];

/** True when a `files` entry ships the given repo-relative path. */
function shipped(rel) {
  return (pkg.files ?? []).some((entry) => {
    const norm = entry.replace(/\\/g, '/').replace(/\/$/, '');
    return rel === norm || rel.startsWith(`${norm}/`);
  });
}

test('package files: every runtime dependency of the installer is shipped', () => {
  for (const rel of RUNTIME_FILES) {
    assert.ok(existsSync(path.join(ROOT, rel)), `${rel} does not exist`);
    assert.ok(shipped(rel), `${rel} exists but is NOT in package.json "files" — npx install would crash`);
  }
});

test('package files: the installer itself and the bin are shipped', () => {
  assert.equal(pkg.bin, 'install.mjs');
  assert.ok(shipped(pkg.bin), 'bin target is not shipped');
});

test('installer: --help exits 0 (a missing import must not reach users)', () => {
  const run = spawnSync(process.execPath, [path.join(ROOT, 'install.mjs'), '--help'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /Usage: npx/);
  assert.match(run.stdout, /available: default/);
});

test('starter config: the file budget matches the schema default and the default preset', () => {  const dir = mkdtempSync(path.join(tmpdir(), 'antislop-starter-'));
  try {
    const run = spawnSync(
      process.execPath,
      [path.join(ROOT, 'install.mjs'), '.', '--for', 'default'],
      { cwd: dir, encoding: 'utf8' },
    );
    assert.equal(run.status, 0, run.stderr);

    const starter = JSON.parse(readFileSync(path.join(dir, 'anti-slop.config.json'), 'utf8'));
    const schema = JSON.parse(readFileSync(path.join(ROOT, 'anti-slop.schema.json'), 'utf8'));
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'presets/default/manifest.json'), 'utf8'));

    const budget = starter.modularity.maxFileLines;
    assert.equal(budget, schema.properties.modularity.properties.maxFileLines.default,
      'starter config disagrees with the schema default');
    assert.equal(budget, manifest.config.modularity.maxFileLines,
      'starter config disagrees with the default preset');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** Install into a fresh (or prepared) temp dir; returns the dir. */
function installInto(prepare = () => {}, args = ['.', '--for', 'default']) {
  const dir = mkdtempSync(path.join(tmpdir(), 'antislop-install-'));
  prepare(dir);
  const run = spawnSync(process.execPath, [path.join(ROOT, 'install.mjs'), ...args], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  return dir;
}

test('installer: the component index is registered as an always-loaded instruction', () => {
  const dir = installInto();
  try {
    const config = JSON.parse(readFileSync(path.join(dir, 'opencode.json'), 'utf8'));
    assert.ok(
      config.instructions.includes('docs/COMPONENT_INDEX.digest.md'),
      'the bounded digest must be loaded into every session, not the unbounded index',
    );
    const createRule = (config.permissions ?? []).find((p) => p.resource === 'gh issue create*');
    assert.ok(createRule, 'filing an issue must be gated on human approval');
    assert.equal(createRule.effect, 'ask');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('installer: an existing opencode.json is merged, not overwritten', () => {
  const dir = installInto((d) => {
    writeFileSync(
      path.join(d, 'opencode.json'),
      JSON.stringify({ $schema: 'https://opencode.ai/config.json', instructions: ['AGENTS.md'], theme: 'x' }),
    );
  });
  try {
    const config = JSON.parse(readFileSync(path.join(dir, 'opencode.json'), 'utf8'));
    assert.deepEqual(config.instructions, ['AGENTS.md', 'docs/COMPONENT_INDEX.digest.md']);
    assert.equal(config.theme, 'x', 'unrelated keys must survive');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('installer: an unparsable opencode.json is left alone', () => {
  const dir = installInto((d) => {
    writeFileSync(path.join(d, 'opencode.json'), '{ not json');
  });
  try {
    assert.equal(readFileSync(path.join(dir, 'opencode.json'), 'utf8'), '{ not json');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('installer: the reviewer agent is installed by default, dormant, and skippable', () => {
  const dir = installInto();
  try {
    const file = path.join(dir, '.opencode', 'agents', 'deslop-reviewer.md');
    assert.ok(existsSync(file), 'reviewer agent must be installed');
    assert.match(readFileSync(file, 'utf8'), /^mode: subagent$/m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const skipped = installInto(() => {}, ['.', '--for', 'default', '--no-reviewer']);
  try {
    assert.equal(existsSync(path.join(skipped, '.opencode', 'agents', 'deslop-reviewer.md')), false);
  } finally {
    rmSync(skipped, { recursive: true, force: true });
  }
});

test('installer: --review-model pins the reviewer model in the agent frontmatter', () => {
  const dir = installInto(() => {}, ['.', '--for', 'default', '--review-model', 'anthropic/claude-sonnet-5-5']);
  try {
    const text = readFileSync(path.join(dir, '.opencode', 'agents', 'deslop-reviewer.md'), 'utf8');
    assert.match(text, /^model: anthropic\/claude-sonnet-5-5$/m);
    assert.match(text, /^mode: subagent$/m, 'frontmatter must stay valid');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
