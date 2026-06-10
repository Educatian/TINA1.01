/* TINA coaching engine — architecture verification (PURE engine, no DOM/LLM).
   Run: node --test src/services/coachingEngine.test.mjs
   (Node >= 22.6 strips TS types on import; tested on Node 24.)
   Mirrors the sail-me test.mjs pattern: classify -> select -> verify. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOVES,
  MOVE_NAMES,
  ALACT_PHASES,
  classifyTurn,
  selectMove,
  shouldClose,
  verifyRender,
  regenerationHint,
  runCoachingTurn,
} from './coachingEngine.ts';

const baseState = (over = {}) => ({
  phase: 'action',
  turnIndex: 2,
  maxTurns: 12,
  classified: classifyTurn('I tried using ChatGPT in my class last week.'),
  ...over,
});

test('taxonomy: every move has a phase, level, and a non-trivial directive', () => {
  for (const name of MOVE_NAMES) {
    const m = MOVES[name];
    assert.ok(ALACT_PHASES.includes(m.phase), `${name} phase valid`);
    assert.ok(typeof m.directive === 'string' && m.directive.length > 30, `${name} has directive`);
    assert.ok(m.directive.includes(name), `${name} directive names the move (control signal)`);
  }
});

test('taxonomy: 8 moves, single source of truth', () => {
  assert.equal(MOVE_NAMES.length, 8);
});

// ---- every move is reachable from selectMove ----
test('reachable: ELICIT_EXPERIENCE at action phase', () => {
  const s = selectMove(baseState({ phase: 'action' }));
  assert.equal(s.move, 'ELICIT_EXPERIENCE');
  assert.equal(s.nextPhase, 'looking_back');
});

test('reachable: LOOK_BACK at looking_back with descriptive turn', () => {
  const classified = classifyTurn('I asked the students to use it and they did the worksheet.');
  const s = selectMove(baseState({ phase: 'looking_back', classified }));
  assert.equal(s.move, 'LOOK_BACK');
});

test('reachable: NAME_ESSENTIAL at awareness with a critical turn', () => {
  const classified = classifyTurn('I think the real tension is because I value fairness but not all students have access.');
  const s = selectMove(baseState({ phase: 'awareness', classified }));
  assert.equal(s.move, 'NAME_ESSENTIAL');
});

test('reachable: REFRAME_PERSPECTIVE at alternatives', () => {
  const classified = classifyTurn('I value equity but the reason it matters is access differs.');
  const s = selectMove(baseState({ phase: 'alternatives', classified }));
  assert.equal(s.move, 'REFRAME_PERSPECTIVE');
});

test('reachable: CONNECT_VALUE_TO_ACTION at trial (even on a shallow turn)', () => {
  const classified = classifyTurn('ok');
  const s = selectMove(baseState({ phase: 'trial', classified }));
  assert.equal(s.move, 'CONNECT_VALUE_TO_ACTION');
});

test('reachable: AFFIRM_AND_HOLD on affect/hesitation', () => {
  const classified = classifyTurn('Honestly I feel really anxious and unsure about all of this.');
  const s = selectMove(baseState({ phase: 'looking_back', classified }));
  assert.equal(s.move, 'AFFIRM_AND_HOLD');
  assert.equal(s.nextPhase, 'looking_back', 'holding move does NOT advance the phase');
});

// ---- shallow turn -> DEEPEN_REFLECTION ----
test('shallow turn past action -> DEEPEN_REFLECTION', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  assert.equal(classified.reflectionLevel !== 'critical', true);
  const s = selectMove(baseState({ phase: 'awareness', classified }));
  assert.equal(s.move, 'DEEPEN_REFLECTION');
  assert.equal(s.nextPhase, 'awareness', 'deepen stays on the same phase');
});

test('technical one-word turn -> shallow', () => {
  const c = classifyTurn('yes');
  assert.equal(c.reflectionLevel, 'technical');
  assert.equal(c.cues.shallow, true);
});

test('shallow does NOT fire at the action phase (we still want to surface)', () => {
  const classified = classifyTurn('hmm');
  const s = selectMove(baseState({ phase: 'action', classified }));
  assert.equal(s.move, 'ELICIT_EXPERIENCE');
});

// ---- end-of-time -> CLOSE_SYNTHESIS ----
test('end-of-turns -> CLOSE_SYNTHESIS', () => {
  const s = selectMove(baseState({ phase: 'awareness', turnIndex: 11, maxTurns: 12 }));
  assert.equal(s.move, 'CLOSE_SYNTHESIS');
});

test('over time budget -> CLOSE_SYNTHESIS even mid-cycle', () => {
  const s = selectMove(baseState({ phase: 'looking_back', turnIndex: 4, elapsedMs: 11 * 60 * 1000, budgetMs: 10 * 60 * 1000 }));
  assert.equal(s.move, 'CLOSE_SYNTHESIS');
});

test('closing phase is sticky -> CLOSE_SYNTHESIS', () => {
  const s = selectMove(baseState({ phase: 'closing', turnIndex: 3 }));
  assert.equal(s.move, 'CLOSE_SYNTHESIS');
});

test('shouldClose: true at last slot, false mid-session', () => {
  assert.equal(shouldClose(baseState({ turnIndex: 11, maxTurns: 12 })), true);
  assert.equal(shouldClose(baseState({ turnIndex: 4, maxTurns: 12 })), false);
});

// ---- classifier on representative teacher utterances ----
test('classifier: critical reasoning utterance', () => {
  const c = classifyTurn('I value equity, but the reason I worry is whose knowledge the AI represents and who decides what is correct.');
  assert.equal(c.reflectionLevel, 'critical');
  assert.ok(c.contentTags.includes('ai-society'));
});

test('classifier: descriptive narration utterance', () => {
  const c = classifyTurn('Last week in my class I used Gemini to draft a lesson and the students worked through it.');
  assert.equal(c.reflectionLevel, 'descriptive');
  assert.ok(c.contentTags.includes('ai-use'));
  assert.equal(c.cues.concreteExample, true);
});

test('classifier: identity + affect tags', () => {
  const c = classifyTurn('As a teacher I really care about my students but I feel anxious about losing that connection.');
  assert.ok(c.contentTags.includes('identity'));
  assert.ok(c.contentTags.includes('affect'));
});

test('classifier: empty / whitespace is technical and shallow, no crash', () => {
  const c = classifyTurn('   ');
  assert.equal(c.reflectionLevel, 'technical');
  assert.equal(c.cues.wordCount, 0);
});

// ---- verifyRender: mirror not advisor ----
test('verify: prescriptive advice flagged', () => {
  const v = verifyRender('NAME_ESSENTIAL', 'You should always fact-check the AI. Here are some tips: step 1...');
  assert.equal(v.ok, false);
  assert.ok(v.violations.includes('prescriptive_advice'));
});

test('verify: a clean reflective question passes', () => {
  const v = verifyRender('LOOK_BACK', 'It sounds like that moment stayed with you. What were you hoping would happen?');
  assert.equal(v.ok, true);
  assert.equal(v.violations.length, 0);
});

test('verify: no question is flagged for a non-closing move', () => {
  const v = verifyRender('ELICIT_EXPERIENCE', 'That makes sense. Thanks for sharing.');
  assert.equal(v.ok, false);
  assert.ok(v.violations.includes('no_question'));
});

test('verify: interrogation (3+ questions) flagged', () => {
  const v = verifyRender('LOOK_BACK', 'What happened? How did you feel? What did the students do?');
  assert.equal(v.ok, false);
  assert.ok(v.violations.includes('too_many_questions'));
});

test('verify: CLOSE_SYNTHESIS report is exempt (declarative)', () => {
  const v = verifyRender('CLOSE_SYNTHESIS', 'TINA Reflection Report. You show a tendency toward equity-centered values.');
  assert.equal(v.ok, true);
});

test('regenerationHint mentions the move directive and the violations', () => {
  const h = regenerationHint('NAME_ESSENTIAL', ['prescriptive_advice', 'no_question']);
  assert.ok(h.includes('NAME_ESSENTIAL'));
  assert.ok(h.includes('prescriptive_advice'));
  assert.ok(h.toLowerCase().includes('one'));
});

// ---- full pipeline + a representative ALACT walk ----
test('runCoachingTurn returns a move + classification + directive', () => {
  const r = runCoachingTurn({
    text: 'I used AI to grade essays last week.',
    history: [],
    phase: 'action',
    turnIndex: 2,
    maxTurns: 12,
  });
  assert.ok(MOVE_NAMES.includes(r.move));
  assert.ok(r.directive.length > 0);
  assert.ok(r.classified.reflectionLevel);
});

test('ALACT walk: a deep, well-paced session advances action->...->trial then closes', () => {
  const deep = 'I value fairness, and the reason this matters is whose knowledge the AI represents, but I worry about access.';
  let phase = 'action';
  const seen = [];
  for (let turn = 2; turn <= 11; turn++) {
    const r = runCoachingTurn({ text: deep, history: [], phase, turnIndex: turn, maxTurns: 12 });
    seen.push(r.move);
    phase = r.nextPhase;
  }
  // the natural ALACT moves should all appear across a deep session
  for (const m of ['ELICIT_EXPERIENCE', 'LOOK_BACK', 'NAME_ESSENTIAL', 'REFRAME_PERSPECTIVE', 'CONNECT_VALUE_TO_ACTION']) {
    assert.ok(seen.includes(m), `expected ${m} in ${seen.join(',')}`);
  }
  // and it must end on the synthesis
  assert.ok(seen.includes('CLOSE_SYNTHESIS'));
});
