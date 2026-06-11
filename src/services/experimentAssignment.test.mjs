/* Experiment assignment — determinism + split-balance checks (PURE, no DOM).
   Run via the combined `npm test` (node --test). import.meta.env is undefined
   under node, so getExperimentMode() falls back to 'on' here; we test the
   hash + bucketing primitives directly, which is where the RCT logic lives. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashToUnitInterval,
  assignCondition,
  EXPERIMENT_ASSIGNMENT_VERSION,
} from './experimentAssignment.ts';

test('hashToUnitInterval is in [0,1) and deterministic', () => {
  for (const key of ['a', 'user-123', '', 'jewoong', '🍌']) {
    const v = hashToUnitInterval(key);
    assert.ok(v >= 0 && v < 1, `${key} -> ${v} in range`);
    assert.equal(v, hashToUnitInterval(key), 'same key -> same value');
  }
});

test('different keys generally produce different buckets', () => {
  const a = hashToUnitInterval('user-aaaa');
  const b = hashToUnitInterval('user-bbbb');
  assert.notEqual(a, b);
});

test('default mode (no import.meta.env) -> everyone treatment, engine on', () => {
  const a = assignCondition('any-user');
  assert.equal(a.mode, 'on');
  assert.equal(a.condition, 'treatment');
  assert.equal(a.engineEnabled, true);
  assert.equal(a.assignmentVersion, EXPERIMENT_ASSIGNMENT_VERSION);
});

test('rct bucketing (via the same salted hash) is ~balanced and stable', () => {
  // Mirror the production bucket computation to validate the split is sane.
  const bucketFor = (id) => hashToUnitInterval(`${EXPERIMENT_ASSIGNMENT_VERSION}:${id}`) < 0.5 ? 'control' : 'treatment';
  let control = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    const arm = bucketFor(`learner-${i}`);
    if (arm === 'control') control += 1;
    assert.equal(arm, bucketFor(`learner-${i}`), 'stable per id');
  }
  const ratio = control / N;
  assert.ok(ratio > 0.45 && ratio < 0.55, `split ~50/50, got control=${ratio.toFixed(3)}`);
});
