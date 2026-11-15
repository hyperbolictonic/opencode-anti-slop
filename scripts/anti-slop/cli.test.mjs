/**
 * Unit tests for CLI/config plumbing (cli.mjs). Zero dependencies — runs with
 * `node --test`. bootstrapGate's flag-to-key camelCasing and the
 * defaults < config < flags merge are contract tests: the gates' hooks call
 * the scripts bare, so the config file must govern them without flags.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { bootstrapGate, globToRegex, matchesAnyGlob, parseFlags } from './cli.mjs';

// --- parseFlags ----------------------------------------------------------------

test('parseFlags: string, number, and flag types', () => {
  const { values, positionals } = parseFlags(
    ['--src', 'lib', '--min-tokens', '30', '--report-only'],
    { '--src': 'string', '--min-tokens': 'number', '--report-only': 'flag' },
  );
  assert.equal(values['--src'], 'lib');
  assert.equal(values['--min-tokens'], 30);
  assert.equal(values['--report-only'], true);
  assert.deepEqual(positionals, []);
});

test('parseFlags: bare words land in positionals', () => {
  const { values, positionals } = parseFlags(['src/a.ts', 'src/b.ts'], {});
  assert.deepEqual(values, {});
  assert.deepEqual(positionals, ['src/a.ts', 'src/b.ts']);
});

test('parseFlags: missing value throws', () => {
  assert.throws(() => parseFlags(['--src'], { '--src': 'string' }), /Missing value/);
});

test('parseFlags: non-numeric number throws', () => {
  assert.throws(
    () => parseFlags(['--max-file-lines', 'abc'], { '--max-file-lines': 'number' }),
    /expects a number/,
  );
});

// --- bootstrapGate ----------------------------------------------------------------

const SPEC = {
  '--src': 'string', '--min-tokens': 'number', '--threshold': 'number',
  '--report-only': 'flag',
};

test('bootstrapGate: flags override defaults, keys camelCased', () => {
  const { args, positionals } = bootstrapGate(
    ['--min-tokens', '20'],
    {
      usage: 'usage',
      spec: SPEC,
      defaults: { src: 'src', minTokens: 50, threshold: 3, reportOnly: false },
    },
  );
  assert.equal(args.src, 'src');
  assert.equal(args.minTokens, 20);
  assert.equal(args.threshold, 3);
  assert.equal(args.reportOnly, false);
  assert.deepEqual(positionals, []);
});

test('bootstrapGate: config defaults flow through unchanged', () => {
  const { args } = bootstrapGate([], {
    usage: 'usage',
    spec: SPEC,
    defaults: { src: 'app', minTokens: 80, threshold: 5 },
  });
  assert.deepEqual(args, { src: 'app', minTokens: 80, threshold: 5, reportOnly: false });
});

test('bootstrapGate: --report-only becomes boolean true', () => {
  const { args } = bootstrapGate(['--report-only'], {
    usage: 'usage', spec: SPEC, defaults: { src: 'src', reportOnly: false },
  });
  assert.equal(args.reportOnly, true);
});

// --- glob matching -----------------------------------------------------------------

test('globToRegex: ** crosses directories, * stays within one', () => {
  assert.ok(globToRegex('collections/**').test('collections/AccessGrants.ts'));
  assert.ok(globToRegex('collections/**').test('collections/nested/Clients.ts'));
  assert.ok(!globToRegex('collections/**').test('src/collections/Clients.ts'));
  assert.ok(globToRegex('app/(payload)/**').test('app/(payload)/admin/page.tsx'));
  assert.ok(globToRegex('lib/*.ts').test('lib/date.ts'));
  assert.ok(!globToRegex('lib/*.ts').test('lib/deep/date.ts'));
  assert.ok(globToRegex('use?.ts').test('useA.ts'));
  assert.ok(!globToRegex('use?.ts').test('useAB.ts'));
  assert.ok(globToRegex('a.b.ts').test('a.b.ts'));
  assert.ok(!globToRegex('a.b.ts').test('axbts'));
});

test('matchesAnyGlob: empty list never matches', () => {
  assert.equal(matchesAnyGlob('anything.ts', []), false);
});

test('matchesAnyGlob: any of several globs', () => {
  assert.ok(matchesAnyGlob('x/y.ts', ['nothing/**', 'x/**']));
});
