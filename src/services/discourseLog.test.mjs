/* TINA discourse pair log — pure pairing/provenance logic (no DOM/network).
   Run: node --test src/services/discourseLog.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDiscourseTurn,
  findAiPrompt,
  withProvenance,
} from './discourseLog.ts';

const aiMsg = (text) => ({ role: 'model', text, timestamp: '2026-06-12T00:00:00Z' });
const userMsg = (text, extra = {}) => ({ role: 'user', text, timestamp: '2026-06-12T00:00:01Z', ...extra });

test('findAiPrompt: returns the LAST model utterance before the learner turn', () => {
  const prior = [aiMsg('greeting'), userMsg('hi'), aiMsg('what stood out today?')];
  assert.equal(findAiPrompt(prior), 'what stood out today?');
});

test('findAiPrompt: skips empty model messages and handles no-model history', () => {
  assert.equal(findAiPrompt([aiMsg('   '), userMsg('hi')]), null);
  assert.equal(findAiPrompt([]), null);
  assert.equal(findAiPrompt([userMsg('hi')]), null);
});

test('buildDiscourseTurn: typed turn — pair fields filled, qr fields null', () => {
  const row = buildDiscourseTurn({
    sessionId: 's1',
    userId: 'u1',
    activityId: 'a1',
    turnIndex: 3,
    priorMessages: [aiMsg('how do you verify AI output?')],
    userMsg: withProvenance(userMsg('I double-check sources'), 3, { source: 'typed' }),
    aiResponseText: 'What makes a source feel trustworthy to you?',
    move: 'DEEPEN_REFLECTION',
  });
  assert.equal(row.session_id, 's1');
  assert.equal(row.turn_index, 3);
  assert.equal(row.ai_prompt_text, 'how do you verify AI output?');
  assert.equal(row.user_text, 'I double-check sources');
  assert.equal(row.user_source, 'typed');
  assert.equal(row.qr_question_id, null);
  assert.equal(row.qr_option_id, null);
  assert.equal(row.qr_question_text, null);
  assert.equal(row.ai_response_text, 'What makes a source feel trustworthy to you?');
  assert.equal(row.move, 'DEEPEN_REFLECTION');
});

test('buildDiscourseTurn: quick-reply click — question/option ids travel into the row', () => {
  const clicked = withProvenance(userMsg('Thorough review'), 2, {
    source: 'quick_reply',
    quickReply: {
      questionId: 'verification_level',
      optionId: 'thorough',
      questionText: 'How do you review AI-generated content before using it?',
    },
  });
  const row = buildDiscourseTurn({
    sessionId: 's1',
    userId: 'u1',
    turnIndex: 2,
    priorMessages: [aiMsg('Before using it, how do you review what AI gives you?')],
    userMsg: clicked,
    aiResponseText: 'That care shows. What drives it?',
  });
  assert.equal(row.user_source, 'quick_reply');
  assert.equal(row.qr_question_id, 'verification_level');
  assert.equal(row.qr_option_id, 'thorough');
  assert.equal(row.qr_question_text, 'How do you review AI-generated content before using it?');
  assert.equal(row.activity_id, null);
  assert.equal(row.move, null);
});

test('buildDiscourseTurn: legacy message without source defaults to typed', () => {
  const row = buildDiscourseTurn({
    sessionId: 's1',
    userId: 'u1',
    turnIndex: 1,
    priorMessages: [],
    userMsg: userMsg('first message'),
    aiResponseText: 'welcome',
  });
  assert.equal(row.user_source, 'typed');
  assert.equal(row.ai_prompt_text, null);
});

test('withProvenance: stamps turnIndex + source, keeps original fields, no mutation', () => {
  const original = userMsg('hello');
  const stamped = withProvenance(original, 5, { source: 'voice' });
  assert.equal(stamped.turnIndex, 5);
  assert.equal(stamped.source, 'voice');
  assert.equal(stamped.text, 'hello');
  assert.equal(original.turnIndex, undefined);
  assert.equal(stamped.quickReply, undefined);
});
