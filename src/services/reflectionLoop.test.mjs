/* Reflection-loop pure helpers — depth scoring + JOL calibration. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  depthScore, depthBand, computeJol,
  extractNextMove, extractCarryQuestions,
} from './reflectionScoring.ts';

const pts = (...levels) => levels.map((l, i) => ({ turnIndex: i + 1, reflectionLevel: l, move: 'X' }));

test('depthScore weights critical>descriptive>technical, empty=0', () => {
  assert.equal(depthScore([]), 0);
  assert.equal(depthScore(pts('technical', 'technical')), 0);
  assert.equal(depthScore(pts('critical', 'critical')), 1);
  assert.equal(depthScore(pts('descriptive', 'descriptive')), 0.5);
  assert.equal(depthScore(pts('critical', 'technical')), 0.5);
});

test('depthBand thresholds map score -> 1/2/3', () => {
  assert.equal(depthBand(0), 1);
  assert.equal(depthBand(0.29), 1);
  assert.equal(depthBand(0.3), 2);
  assert.equal(depthBand(0.59), 2);
  assert.equal(depthBand(0.6), 3);
  assert.equal(depthBand(1), 3);
});

test('computeJol returns gap = self - measured (over/under confidence)', () => {
  const deep = pts('critical', 'critical', 'critical');   // measured band 3
  assert.equal(computeJol(3, deep).gap, 0, 'well calibrated');
  assert.equal(computeJol(1, deep).gap, -2, 'under-confident');

  const shallow = pts('technical', 'technical');          // measured band 1
  assert.equal(computeJol(3, shallow).gap, 2, 'over-confident');
  const r = computeJol(2, shallow);
  assert.equal(r.measuredBand, 1);
  assert.equal(r.selfRating, 2);
  assert.equal(r.gap, 1);
});

test('next-move + carry extraction still parse the report grammar', () => {
  const report = '**1) What Stood Out**\nsome text\n**7) One Next Move**\nTry a 3-minute exit ticket tomorrow.\n**6) Questions To Carry Forward**\nQ1: Whose knowledge does AI represent?\nQ2: How do I make effort visible?';
  assert.match(extractNextMove(report), /exit ticket/);
  const qs = extractCarryQuestions(report);
  assert.ok(qs.length >= 2 && /knowledge/.test(qs[0]));
});

// ---- reflectorLevelFromHistory (faded scaffolding signal) -----------------
import { reflectorLevelFromHistory, REFLECTOR_HISTORY_MIN_TURNS } from './reflectionScoring.ts';

test('reflectorLevelFromHistory: thin history -> developing (neutral default)', () => {
  assert.equal(reflectorLevelFromHistory(0, 1), 'developing');
  assert.equal(reflectorLevelFromHistory(REFLECTOR_HISTORY_MIN_TURNS - 1, 1), 'developing');
});

test('reflectorLevelFromHistory: deep history -> advanced, shallow -> novice', () => {
  assert.equal(reflectorLevelFromHistory(10, 0.6), 'advanced');
  assert.equal(reflectorLevelFromHistory(10, 0.9), 'advanced');
  assert.equal(reflectorLevelFromHistory(10, 0.25), 'novice');
  assert.equal(reflectorLevelFromHistory(10, 0.1), 'novice');
});

test('reflectorLevelFromHistory: mid-range with enough history -> developing', () => {
  assert.equal(reflectorLevelFromHistory(10, 0.4), 'developing');
});
