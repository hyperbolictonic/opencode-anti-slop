/**
 * resolve.mjs — preset resolution helpers for install.mjs.
 *
 * A preset is `presets/<name>/manifest.json` (+ optional `skills/`):
 * pure data selecting installed skills, scanned extensions, and the starter
 * config. Nothing here copies files — that stays in install.mjs.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Preset directory names that carry a manifest.json, in scan order. */
export function availablePresetNames(presetsDir) {
  if (!existsSync(presetsDir)) return [];
  return readdirSync(presetsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(path.join(presetsDir, e.name, 'manifest.json')))
    .map((e) => e.name);
}

/**
 * Resolve `--for <name>` against a presets directory.
 * Returns null for the default preset (install everything, no overrides).
 * Throws with an actionable message for unknown names.
 */
export function resolvePreset(presetsDir, name) {
  const available = availablePresetNames(presetsDir);
  if (name === 'default' || !available.includes(name)) {
    if (name !== 'default') {
      throw new Error(
        `Unknown preset "${name}". Available: ${available.length > 0 ? available.join(', ') : 'default'}`,
      );
    }
    return null;
  }
  const manifest = JSON.parse(readFileSync(path.join(presetsDir, name, 'manifest.json'), 'utf8'));
  if (!manifest || typeof manifest !== 'object' || !manifest.name) {
    throw new Error(`Preset "${name}" has an invalid manifest (missing name).`);
  }

  const skills = Array.isArray(manifest.skills) && manifest.skills.length > 0
    ? new Set(manifest.skills)
    : null; // null = install every kit skill
  // Extensions live at the manifest top level; config.scan.extensions is an
  // accepted alternative for preset authors who prefer it there.
  const extensions = Array.isArray(manifest.extensions)
    ? manifest.extensions
    : (Array.isArray(manifest.config?.scan?.extensions) ? manifest.config.scan.extensions : null);
  const config = (manifest.config && typeof manifest.config === 'object') ? manifest.config : null;

  return {
    name,
    status: manifest.status ?? 'unspecified',
    description: manifest.description ?? '',
    skills,
    extensions,
    config,
    skillsDir: path.join(presetsDir, name, 'skills'),
  };
}

/** Merge a preset's config sections over the starter config (per section). */
export function mergeStarterConfig(base, presetConfig) {
  if (!presetConfig) return base;
  return Object.fromEntries(
    Object.keys(base).map((k) => [k, { ...base[k], ...(presetConfig[k] ?? {}) }]),
  );
}
