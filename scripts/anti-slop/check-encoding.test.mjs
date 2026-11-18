/**
 * Tests for the encoding guard: mojibake detection, the cp1252->UTF-8
 * reverse repair, BOM detection, and the PowerShell round-trip failure mode
 * that motivated the gate.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  isSuspectMojibake, repairDoubleEncodedUtf8, hasUtf8Bom, utf8ToCp1252String,
} from './check-encoding.mjs';

test('isSuspectMojibake: detects the UTF-8-as-CP1252 signatures', () => {
  const corrupted = utf8ToCp1252String('├── manifest.json — required');
  assert.ok(isSuspectMojibake(corrupted));
  assert.ok(isSuspectMojibake(utf8ToCp1252String('évidence — café')));
  assert.ok(isSuspectMojibake(utf8ToCp1252String("doesn't — it's")));
});

test('isSuspectMojibake: clean text and legit unicode pass', () => {
  assert.ok(!isSuspectMojibake('plain ASCII text'));
  assert.ok(!isSuspectMojibake('├── manifest.json — selects and configures')); // legit box-drawing
  assert.ok(!isSuspectMojibake('café — naïve — 日本語')); // legit accents + CJK
  assert.ok(!isSuspectMojibake('the gateâs own source')); // standalone â is not a signature
});

test('repairDoubleEncodedUtf8: reverses the round-trip exactly', () => {
  const original = '├── manifest.json — required — évidence — café';
  const corrupted = utf8ToCp1252String(original);
  assert.ok(isSuspectMojibake(corrupted));
  const repaired = repairDoubleEncodedUtf8(corrupted);
  assert.equal(repaired, original);
});

test('repairDoubleEncodedUtf8: mixed-state file (partly clean) returns null', () => {
  const mixed = 'clean — text\n' + utf8ToCp1252String('mojibake — here'); // a real em-dash can't reverse to a single cp1252 byte cleanly
  assert.equal(repairDoubleEncodedUtf8(mixed), null);
});

test('hasUtf8Bom: detects and rejects BOM', () => {
  assert.ok(hasUtf8Bom('\uFEFF# Header'));
  assert.ok(!hasUtf8Bom('# Header'));
});
