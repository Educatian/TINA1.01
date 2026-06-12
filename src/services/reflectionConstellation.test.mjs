/* TINA values-and-tensions constellation — pure parsing + geometry.
   Run: node --test src/services/reflectionConstellation.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractValues, extractTension, buildConstellation, VIEW_W, VIEW_H,
} from './reflectionConstellation.ts';

const REPORT = [
  '**1) What Stood Out In Your Reflection**',
  '- Main pattern noticed: you kept returning to fairness.',
  '- Strengths that are emerging: an honest, questioning stance.',
  '- Tensions or open questions: you value equity but rely on paid AI tools.',
  '',
  '**2) Values Guiding You Right Now**',
  '- Equity: you weigh how choices land on every student.',
  '- Care: you notice how students feel.',
  '- Honesty: you name what feels off.',
  '',
  '**7) One Next Move**',
  'Tell students which parts of a task you used AI for.',
].join('\n');

test('extractValues parses name + note, skips placeholders/empties', () => {
  const v = extractValues(REPORT);
  assert.equal(v.length, 3);
  assert.deepEqual(v.map((x) => x.name), ['Equity', 'Care', 'Honesty']);
  assert.match(v[0].note, /every student/);
});

test('extractValues drops the unfilled template', () => {
  const tpl = '**2) Values Guiding You Right Now**\n- [Value Name]: [Brief observation]\n- Equity: real note';
  const v = extractValues(tpl);
  assert.deepEqual(v.map((x) => x.name), ['Equity']);
});

test('extractValues returns [] when there is no values section', () => {
  assert.deepEqual(extractValues('just some prose, no sections'), []);
  assert.deepEqual(extractValues(null), []);
});

test('extractTension pulls the tensions line, null when absent', () => {
  assert.match(extractTension(REPORT), /paid AI tools/);
  assert.equal(extractTension('**2) Values Guiding You Right Now**\n- Care: x'), null);
});

test('buildConstellation lays stars inside the view box, with the tension', () => {
  const c = buildConstellation(REPORT);
  assert.equal(c.values.length, 3);
  for (const s of c.values) {
    assert.ok(s.x >= 0 && s.x <= VIEW_W, `x in range: ${s.x}`);
    assert.ok(s.y >= 0 && s.y <= VIEW_H, `y in range: ${s.y}`);
  }
  // first value carries the highest weight (more central to identity)
  assert.ok(c.values[0].weight >= c.values[2].weight);
  assert.equal(c.center.x, VIEW_W / 2);
  assert.match(c.tension, /paid AI tools/);
});

test('buildConstellation is empty-safe', () => {
  const c = buildConstellation('');
  assert.deepEqual(c.values, []);
  assert.equal(c.tension, null);
});
