/**
 * Validates every preset in presets/: manifests parse, name matches the
 * directory, status is honest, listed skills exist (kit or preset-local),
 * and extensions are well-formed. A preset PR with a broken manifest fails
 * CI before review (the mechanical half of the CONTRIBUTING.md checklist).
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presetsDir = path.join(root, 'presets');
const kitSkillsDir = path.join(root, '.opencode', 'skills');

function presetDirs() {
  return readdirSync(presetsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(presetsDir, e.name, 'manifest.json')))
    .map((e) => e.name);
}

function skillExists(presetName, skillName) {
  return (
    existsSync(path.join(kitSkillsDir, skillName, 'SKILL.md')) ||
    existsSync(path.join(presetsDir, presetName, 'skills', skillName, 'SKILL.md'))
  );
}

const EXT_RE = /^\.[A-Za-z0-9]+$/;

test('presets: every directory with a manifest parses and matches its name', () => {
  for (const name of presetDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
    assert.equal(manifest.name, name, `manifest.name must match the directory "${name}"`);
  }
});

test('presets: status is honest — experimental or stable', () => {
  for (const name of presetDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
    assert.ok(
      manifest.status === 'experimental' || manifest.status === 'stable',
      `preset "${name}" must carry status "experimental" or "stable" (got: ${manifest.status})`,
    );
    assert.equal(typeof manifest.description, 'string', `preset "${name}" needs a description`);
    assert.ok(manifest.description.length > 0, `preset "${name}" has an empty description`);
  }
});

test('presets: listed skills exist in the kit or as preset-local skills', () => {
  for (const name of presetDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest.skills)) continue;
    for (const skill of manifest.skills) {
      assert.ok(
        skillExists(name, skill),
        `preset "${name}" lists skill "${skill}" — it exists neither in .opencode/skills nor in presets/${name}/skills/`,
      );
    }
  }
});

test('presets: extensions are well-formed dot-extensions', () => {
  for (const name of presetDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
    if (!Array.isArray(manifest.extensions)) continue;
    for (const ext of manifest.extensions) {
      assert.match(ext, EXT_RE, `preset "${name}" extension "${ext}" must be a dot-extension like ".cpp"`);
    }
  }
});

test('presets: experimental presets disclose inert gates in their description', () => {
  for (const name of presetDirs()) {
    const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
    if (manifest.status !== 'experimental') continue;
    const exts = Array.isArray(manifest.extensions) ? manifest.extensions : [];
    const nonJs = exts.some((e) => !['.ts', '.tsx', '.js', '.jsx', '.mjs', '.mts'].includes(e));
    if (nonJs) {
      const desc = manifest.description.toLowerCase();
      assert.ok(
        desc.includes('inert') || desc.includes('limited'),
        `experimental preset "${name}" scans non-JS extensions (${exts.join(', ')}) — its description must disclose which gates are inert/limited for the language`,
      );
    }
  }
});

test('presets: the default preset is stable and installs every kit skill', () => {
  const manifest = JSON.parse(readFileSync(path.join(presetsDir, 'default', 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'stable');
  const kitSkills = readdirSync(kitSkillsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(kitSkillsDir, e.name, 'SKILL.md')))
    .map((e) => e.name);
  for (const skill of kitSkills) {
    assert.ok(manifest.skills.includes(skill), `default preset must list kit skill "${skill}"`);
  }
});
