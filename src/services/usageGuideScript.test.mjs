/* TINA usage-guide script — pure track/narration grammar (no DOM/network).
   Run: node --test src/services/usageGuideScript.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUsageGuide,
  GUIDE_ROLES,
  GUIDE_NARRATION_TEXT,
  usageGuideSeenKey,
} from './usageGuideScript.ts';

test('two role tracks exist and are non-empty', () => {
  assert.equal(GUIDE_ROLES.length, 2);
  assert.ok(buildUsageGuide('learner').length >= 5);
  assert.ok(buildUsageGuide('instructor').length >= 5);
});

test('learner and instructor tracks are distinct', () => {
  const l = buildUsageGuide('learner').map((s) => s.id);
  const i = buildUsageGuide('instructor').map((s) => s.id);
  assert.notDeepEqual(l, i);
  assert.ok(l.every((id) => id.startsWith('l-')));
  assert.ok(i.every((id) => id.startsWith('i-')));
});

test('every step has title, body, frame, icon, and a clipId == id', () => {
  for (const role of ['learner', 'instructor']) {
    for (const s of buildUsageGuide(role)) {
      assert.ok(s.title && s.title.length > 1, `${s.id} title`);
      assert.ok(s.body && s.body.length > 20, `${s.id} body`);
      assert.match(s.frame, /\.png$/, `${s.id} frame is a png`);
      assert.ok(s.icon, `${s.id} icon`);
      assert.equal(s.clipId, s.id, `${s.id} clipId mirrors id`);
    }
  }
});

test('every step body exactly equals its canonical narration text (voice == screen)', () => {
  for (const role of ['learner', 'instructor']) {
    for (const s of buildUsageGuide(role)) {
      assert.equal(s.body, GUIDE_NARRATION_TEXT[s.id], `${s.id} narration parity`);
    }
  }
});

test('narration text map has no orphans (every clip is used by a step)', () => {
  const used = new Set([...buildUsageGuide('learner'), ...buildUsageGuide('instructor')].map((s) => s.clipId));
  for (const id of Object.keys(GUIDE_NARRATION_TEXT)) {
    assert.ok(used.has(id), `clip ${id} is referenced by a step`);
  }
});

test('unknown role falls back to the learner track', () => {
  assert.deepEqual(buildUsageGuide('bogus'), buildUsageGuide('learner'));
});

test('usageGuideSeenKey is stable + role-scoped', () => {
  assert.equal(usageGuideSeenKey('learner'), 'tina-usage-guide-seen-learner');
  assert.notEqual(usageGuideSeenKey('learner'), usageGuideSeenKey('instructor'));
});

test('every step has a non-empty detail paragraph for the full-page guide', () => {
  for (const role of ['learner', 'instructor']) {
    for (const s of buildUsageGuide(role)) {
      assert.ok(typeof s.detail === 'string' && s.detail.length > 60, `${s.id} has a substantial detail`);
      assert.notEqual(s.detail, s.body, `${s.id} detail differs from the short narration`);
    }
  }
});
