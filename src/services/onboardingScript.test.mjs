/* Onboarding narration script — pure structure + activity-awareness checks. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOnboardingScript, onboardingSeenKey } from './onboardingScript.ts';

test('null config -> valid generic script (reflection scenario)', () => {
  const steps = buildOnboardingScript(null);
  assert.ok(steps.length >= 4);
  for (const s of steps) {
    assert.ok(s.id && s.body && s.cta, `${s.id} has body + cta`);
    assert.ok(['idle', 'thinking', 'listening', 'walking', 'celebrating'].includes(s.avatarState));
  }
  // first step welcomes (walking), last hands off into the chat
  assert.equal(steps[0].avatarState, 'walking');
  assert.equal(steps[steps.length - 1].id, 'handoff');
  const scenario = steps.find((s) => s.variant === 'scenario');
  assert.ok(scenario && /ChatGPT|lesson/i.test(scenario.body), 'reflection scenario present');
});

test('activity goal selects the matching scenario', () => {
  const ethics = buildOnboardingScript({ activityGoal: 'ethics-decision' });
  const card = ethics.find((s) => s.variant === 'scenario');
  assert.match(card.body, /no rule|fair/i);

  const feedback = buildOnboardingScript({ activityGoal: 'feedback-revision' });
  assert.match(feedback.find((s) => s.variant === 'scenario').body, /feedback|essays/i);
});

test('topic is woven into the scenario card when present', () => {
  const steps = buildOnboardingScript({ activityGoal: 'reflection', topic: 'AI in formative assessment' });
  const card = steps.find((s) => s.variant === 'scenario');
  assert.match(card.body, /AI in formative assessment/);
});

test('learner level changes the framing wording', () => {
  const grad = buildOnboardingScript({ activityGoal: 'reflection', learnerLevel: 'graduate' });
  assert.ok(grad.some((s) => s.body.includes('your practice')));
  const prac = buildOnboardingScript({ activityGoal: 'reflection', learnerLevel: 'practicum-ready' });
  assert.ok(prac.some((s) => s.body.includes('your practicum')));
});

test('onboardingSeenKey is stable + per-user', () => {
  assert.equal(onboardingSeenKey('u1'), 'tina-onboarded-u1');
  assert.equal(onboardingSeenKey(null), 'tina-onboarded-anon');
});
