/* TINA artifact-anchored reflection — pure directive grammar (no DOM/network).
   Run: node --test src/services/artifactService.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArtifactDirective,
  normalizeArtifact,
  hasArtifact,
  getSessionArtifact,
  ARTIFACT_KIND_OPTIONS,
} from './artifactService.ts';

test('hasArtifact: empty/whitespace -> false, note or link -> true', () => {
  assert.equal(hasArtifact(null), false);
  assert.equal(hasArtifact({ kind: 'other', note: '   ' }), false);
  assert.equal(hasArtifact({ kind: 'other', note: 'a real lesson' }), true);
  assert.equal(hasArtifact({ kind: 'other', note: '', link: 'https://x' }), true);
});

test('normalizeArtifact: trims, drops empties, defaults bad kind to other', () => {
  assert.equal(normalizeArtifact(null), null);
  assert.equal(normalizeArtifact({ note: '   ', link: '  ' }), null);
  const a = normalizeArtifact({ kind: 'lesson-plan', note: '  my plan  ', link: ' https://x ' });
  assert.deepEqual(a, { kind: 'lesson-plan', note: 'my plan', link: 'https://x' });
  const b = normalizeArtifact({ kind: 'bogus', note: 'x' });
  assert.equal(b.kind, 'other');
  assert.equal(b.link, undefined);
});

test('buildArtifactDirective: empty -> no-op string', () => {
  assert.equal(buildArtifactDirective(null), '');
  assert.equal(buildArtifactDirective({ kind: 'other', note: '' }), '');
});

test('buildArtifactDirective: anchors on the artifact, forbids grading, keeps one-question rule', () => {
  const d = buildArtifactDirective({ kind: 'ai-prompt', note: 'Write 5 quiz questions on photosynthesis', link: 'https://doc/1' });
  assert.match(d, /^\[ARTIFACT ANCHOR/);
  assert.match(d, /\]$/);
  assert.match(d, /AI prompt/i);
  assert.match(d, /do not evaluate, grade/i);
  assert.match(d, /one-question rule/i);
  assert.match(d, /Write 5 quiz questions on photosynthesis/);
  assert.match(d, /https:\/\/doc\/1/);
});

test('buildArtifactDirective: long notes are truncated for a lean turn', () => {
  const long = 'x'.repeat(2000);
  const d = buildArtifactDirective({ kind: 'lesson-plan', note: long });
  assert.ok(d.length < 1000, 'injected directive stays compact');
  assert.match(d, /\.\.\./, 'truncation ellipsis present');
});

test('getSessionArtifact: reads + normalizes a persisted row, null-safe', () => {
  assert.equal(getSessionArtifact(null), null);
  assert.equal(getSessionArtifact({}), null);
  const a = getSessionArtifact({ artifact_context: { kind: 'student-work', note: ' work ' } });
  assert.deepEqual(a, { kind: 'student-work', note: 'work', link: undefined });
});

test('ARTIFACT_KIND_OPTIONS: stable, non-empty option set', () => {
  assert.ok(ARTIFACT_KIND_OPTIONS.length >= 4);
  for (const o of ARTIFACT_KIND_OPTIONS) {
    assert.ok(o.value && o.label, 'each option has a value + label');
  }
});
