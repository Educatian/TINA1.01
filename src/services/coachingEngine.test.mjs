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
  buildGroundingExcerpts,
  contentWords,
  sharedContentCount,
  lastAiQuestionFrom,
  extractUptakeAnchor,
  assessUptake,
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

test('taxonomy: 9 moves, single source of truth', () => {
  assert.equal(MOVE_NAMES.length, 9);
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

// ---- shallow turn -> DEEPEN_REFLECTION -> SCAFFOLD_WITH_STEM escalation ----
test('shallow turn past action -> DEEPEN_REFLECTION', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  assert.equal(classified.reflectionLevel !== 'critical', true);
  const s = selectMove(baseState({ phase: 'awareness', classified }));
  assert.equal(s.move, 'DEEPEN_REFLECTION');
  assert.equal(s.nextPhase, 'awareness', 'deepen stays on the same phase');
});

test('repeated shallow turns -> SCAFFOLD_WITH_STEM (no endless why-probing)', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  const s = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 1 }));
  assert.equal(s.move, 'SCAFFOLD_WITH_STEM');
  assert.equal(s.nextPhase, 'awareness', 'scaffold stays on the same phase');
  assert.equal(s.reason, 'repeated_shallow_needs_scaffold');
});

test('first shallow turn still gets the open probe (consecutiveShallow 0)', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  const s = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 0 }));
  assert.equal(s.move, 'DEEPEN_REFLECTION');
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

test('classifier: a single hedge on a plain descriptive turn is NOT affect', () => {
  const c = classifyTurn('I think I used it for my lesson plan in my class last week.');
  assert.equal(c.cues.affect, false, '"i think" alone must not trigger holding moves');
  const s = selectMove(baseState({ phase: 'looking_back', classified: c }));
  assert.equal(s.move, 'LOOK_BACK', 'descriptive turn proceeds through the cycle');
});

test('classifier: stacked hedges still read as real hesitation', () => {
  const c = classifyTurn('I think maybe it went fine, I guess.');
  assert.equal(c.cues.affect, true);
});

test('classifier: genuine emotion word is affect', () => {
  const c = classifyTurn('Honestly that lesson made me really anxious.');
  assert.equal(c.cues.affect, true);
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

// ---- coverage steering: Layer 3 lens on the reframe ----
test('REFRAME_PERSPECTIVE gains the AI-society lens when layer 3 never surfaced', () => {
  const classified = classifyTurn('I value equity but the reason it matters is my students need me.');
  const s = selectMove(baseState({ phase: 'alternatives', classified, coveredTags: ['identity', 'ai-use'] }));
  assert.equal(s.move, 'REFRAME_PERSPECTIVE');
  assert.ok(s.directive.includes('AI-and-society lens'), 'directive steers toward layer 3');
});

test('REFRAME_PERSPECTIVE stays plain when AI-society already surfaced', () => {
  const classified = classifyTurn('I value equity but the reason it matters is access differs.');
  const s = selectMove(baseState({ phase: 'alternatives', classified, coveredTags: ['identity', 'ai-society'] }));
  assert.equal(s.move, 'REFRAME_PERSPECTIVE');
  assert.ok(!s.directive.includes('AI-and-society lens'));
});

// ---- evidence grounding for the closing report ----
test('buildGroundingExcerpts picks substantive learner turns, skips fillers', () => {
  const history = [
    { role: 'model', text: 'What stood out to you?' },
    { role: 'user', text: 'yes' },
    { role: 'user', text: 'I worry because I value fairness but my students do not all have access to the paid tools, and I cannot reconcile that yet.' },
    { role: 'model', text: 'Say more?' },
    { role: 'user', text: 'Last week I used Gemini to draft a lesson and then I rewrote most of it myself.' },
  ];
  const excerpts = buildGroundingExcerpts(history);
  assert.ok(excerpts.length >= 2);
  assert.ok(excerpts.some((e) => e.includes('fairness')));
  assert.ok(!excerpts.includes('yes'));
});

test('buildGroundingExcerpts truncates very long turns and caps at 3', () => {
  const long = 'because I think the tension is real and it matters '.repeat(20);
  const history = [1, 2, 3, 4, 5].map(() => ({ role: 'user', text: long }));
  const excerpts = buildGroundingExcerpts(history);
  assert.equal(excerpts.length, 3);
  for (const e of excerpts) assert.ok(e.length <= 220);
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

// ---- faded / adaptive scaffolding (reflectorLevel) ------------------------
test('faded scaffolding: advanced reflector gets an extra open probe before the stem', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  // At one prior shallow turn, the default learner is already escalated to a
  // stem; an advanced reflector instead earns another DEEPEN probe.
  const adv = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 1, reflectorLevel: 'advanced' }));
  assert.equal(adv.move, 'DEEPEN_REFLECTION');
  // Only at the third consecutive shallow turn does the advanced learner get a stem.
  const advStem = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 2, reflectorLevel: 'advanced' }));
  assert.equal(advStem.move, 'SCAFFOLD_WITH_STEM');
});

test('faded scaffolding: novice/developing keep the default threshold (stem at 2nd shallow)', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  for (const level of ['novice', 'developing', undefined]) {
    const s = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 1, reflectorLevel: level }));
    assert.equal(s.move, 'SCAFFOLD_WITH_STEM', `level=${level} escalates at the default threshold`);
  }
});

test('faded scaffolding: directive tone is tuned for advanced vs novice, neutral default', () => {
  const classified = classifyTurn('I just used it for a quiz.');
  const adv = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 0, reflectorLevel: 'advanced' }));
  assert.equal(adv.move, 'DEEPEN_REFLECTION');
  assert.match(adv.directive, /track record of deep, critical reflection/i);
  const nov = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 0, reflectorLevel: 'novice' }));
  assert.match(nov.directive, /early in building reflective habits/i);
  const dev = selectMove(baseState({ phase: 'awareness', classified, consecutiveShallow: 0, reflectorLevel: 'developing' }));
  assert.equal(dev.directive, MOVES.DEEPEN_REFLECTION.directive, 'developing leaves the directive untouched');
});

test('faded scaffolding: reflectorLevel does not change non-scaffolding moves', () => {
  const classified = classifyTurn('I think the real tension is because I value fairness but not all students have access.');
  const a = selectMove(baseState({ phase: 'awareness', classified, reflectorLevel: 'advanced' }));
  const b = selectMove(baseState({ phase: 'awareness', classified, reflectorLevel: 'novice' }));
  assert.equal(a.move, 'NAME_ESSENTIAL');
  assert.equal(b.move, 'NAME_ESSENTIAL');
  assert.equal(a.directive, b.directive, 'a critical turn is unaffected by reflector level');
});

// ============================================================================
// UPTAKE + ALIGNMENT GUARDRAILS (conversational grounding / stepwise bridge)
// ============================================================================

const aiTurn = (text) => ({ role: 'model', text });
const learnerTurn = (text) => ({ role: 'user', text });

test('contentWords: strips stopwords and short tokens', () => {
  const w = contentWords('I think the students were using ChatGPT for essays');
  assert.ok(w.includes('students') && w.includes('chatgpt') && w.includes('essays'));
  assert.ok(!w.includes('the') && !w.includes('think'));
});

test('sharedContentCount: fuzzy-stemmed overlap (grading/grade matches)', () => {
  assert.ok(sharedContentCount('How do you feel about grading with AI?', 'I graded the essays myself') >= 1);
  assert.equal(sharedContentCount('How was your lesson plan?', 'My football team lost yesterday'), 0);
});

test('lastAiQuestionFrom: last question sentence of the most recent model turn', () => {
  const history = [
    aiTurn('Welcome! What brings you here today?'),
    learnerTurn('I want to talk about AI.'),
    aiTurn('That sounds important. When you used AI for grading, what did you feel in that moment?'),
  ];
  const q = lastAiQuestionFrom(history);
  assert.match(q, /what did you feel in that moment\?$/i);
});

test('lastAiQuestionFrom: null when the latest model turn asked nothing', () => {
  assert.equal(lastAiQuestionFrom([aiTurn('Thank you for sharing that thought.')]), null);
  assert.equal(lastAiQuestionFrom([]), null);
});

test('extractUptakeAnchor: picks the substantive clause and stays quotable', () => {
  const anchor = extractUptakeAnchor('Yeah, I guess so. Honestly I rely on ChatGPT for my lesson planning every single week.');
  assert.ok(anchor && anchor.toLowerCase().includes('chatgpt'));
  assert.ok(anchor.length <= 61);
  assert.equal(extractUptakeAnchor('ok'), null);
});

test('assessUptake: substantive reply ignoring the question = digression', () => {
  const history = [aiTurn('When you used AI for grading essays, what did you feel about fairness?')];
  const off = assessUptake('By the way my school just announced a new schedule for parent meetings next month', history);
  assert.equal(off.digression, true);
  const on = assessUptake('I felt the grading was unfair to students who wrote by hand', history);
  assert.equal(on.digression, false);
});

test('assessUptake: short or question-less contexts never flag digression', () => {
  const history = [aiTurn('When you used AI for grading, what did you feel?')];
  assert.equal(assessUptake('not sure really', history).digression, false, 'short turn is minimal, not digression');
  assert.equal(assessUptake('My school announced a brand new schedule for parent meetings next month', [aiTurn('I hear you.')]).digression, false, 'no pending question');
});

test('selectMove: digression holds the phase and renders a stepwise bridge', () => {
  const classified = classifyTurn(
    'By the way my school just announced a new schedule for parent meetings next month',
    [aiTurn('When you used AI for grading essays, what did you feel about fairness?')],
  );
  const s = selectMove(baseState({ phase: 'awareness', classified }));
  assert.equal(s.nextPhase, 'awareness', 'phase is held — its material was not produced');
  assert.equal(s.reason, 'digression_bridge');
  assert.match(s.directive, /BRIDGE FIRST/);
  assert.match(s.directive, /speaking of/i);
  assert.match(s.directive, /NAME_ESSENTIAL/, 'still enacts the held phase move (diagnostic goal kept)');
});

test('selectMove: closing beats bridging; affect-hold beats bridging', () => {
  const offTrack = classifyTurn(
    'By the way my school just announced a new schedule for parent meetings next month',
    [aiTurn('What did you feel about fairness in grading?')],
  );
  const closing = selectMove(baseState({ phase: 'awareness', classified: offTrack, turnIndex: 11, maxTurns: 12 }));
  assert.equal(closing.move, 'CLOSE_SYNTHESIS');
  const anxious = classifyTurn(
    'By the way I am really worried and anxious about the new schedule at my school honestly',
    [aiTurn('What did you feel about fairness in grading?')],
  );
  const held = selectMove(baseState({ phase: 'awareness', classified: anxious }));
  assert.equal(held.move, 'AFFIRM_AND_HOLD', 'warmth before bridging');
});

test('runCoachingTurn: on-track turn gets the uptake anchor in the directive', () => {
  const r = runCoachingTurn({
    text: 'I felt torn because grading with AI seemed unfair to my handwriting students',
    history: [aiTurn('When you used AI for grading essays, what did you feel about fairness?')],
    phase: 'awareness',
    turnIndex: 4,
    maxTurns: 12,
  });
  assert.match(r.directive, /Conversational uptake/);
  assert.ok(r.classified.uptake.anchor && r.directive.includes(r.classified.uptake.anchor));
});

test('runCoachingTurn: bridge turn does not double-instruct uptake', () => {
  const r = runCoachingTurn({
    text: 'By the way my school just announced a new schedule for parent meetings next month',
    history: [aiTurn('When you used AI for grading essays, what did you feel about fairness?')],
    phase: 'awareness',
    turnIndex: 4,
    maxTurns: 12,
  });
  assert.equal(r.reason, 'digression_bridge');
  assert.match(r.directive, /BRIDGE FIRST/);
  assert.ok(!r.directive.includes('Conversational uptake:'), 'bridge already scripts its own uptake');
});

test('verifyRender: zero-overlap reply flags no_uptake; any real uptake passes', () => {
  const learner = 'I rely on ChatGPT for grading essays and it makes me feel guilty';
  const disconnected = verifyRender('LOOK_BACK', 'Interesting. What would your ideal classroom look like someday?', learner);
  assert.ok(disconnected.violations.includes('no_uptake'));
  const connected = verifyRender('LOOK_BACK', 'You said grading with ChatGPT leaves you feeling guilty. What sits under that?', learner);
  assert.ok(!connected.violations.includes('no_uptake'));
});

test('verifyRender: no_uptake is lenient — short learner turns and CLOSE are exempt', () => {
  const short = verifyRender('LOOK_BACK', 'What would you like to explore today?', 'yes ok');
  assert.ok(!short.violations.includes('no_uptake'));
  const close = verifyRender('CLOSE_SYNTHESIS', 'TINA Reflection Report ...', 'I rely on ChatGPT for grading essays every week');
  assert.equal(close.ok, true);
  const legacy = verifyRender('LOOK_BACK', 'What matters most to you here?');
  assert.ok(!legacy.violations.includes('no_uptake'), 'omitted learnerText keeps old behavior');
});

test('regenerationHint: no_uptake instructs referencing the learner words', () => {
  const hint = regenerationHint('LOOK_BACK', ['no_uptake']);
  assert.match(hint, /referencing or restating their own words/i);
});

test('assessUptake: engaging the SUBSTANTIVE question is on-track even when a thin follow-up question came last (live-sim regression)', () => {
  const history = [aiTurn(
    'That sounds exciting! Could you share a specific recent instance where you used ChatGPT for grading or feedback? What was that moment like for you?',
  )];
  const on = assessUptake(
    'Back to the grading - I worry the AI feedback misses what my students actually struggle with in their writing',
    history,
  );
  assert.equal(on.digression, false, 'answered the substantive question, not the thin trailing one');
  const off = assessUptake(
    'Did you hear the news about the World Cup schedule? My brother got tickets and we are planning a trip',
    history,
  );
  assert.equal(off.digression, true, 'true non-sequitur still bridges');
});
