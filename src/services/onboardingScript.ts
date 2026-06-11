/* ============================================================================
   TINA — ONBOARDING NARRATION SCRIPT (PURE, no DOM/LLM)

   A first-run, ~45s, skippable narrated tour delivered BY the TINA character
   (the Higgsfield avatar states). It primes the three things a cold-start
   learner otherwise misses: (1) this is reflection, not a graded task,
   (2) TINA is a mirror, not a judge, (3) short honest answers work best — and
   it shows a concrete scenario so the kind of "honest tension" TINA explores
   is modelled before the real chat begins.

   The scenario step is ACTIVITY-AWARE: it adapts to the instructor's
   ActivityConfig (goal + topic) so the priming matches the assignment.

   Each step carries its own narration `body`, which is also the unit a future
   voice layer (ElevenLabs) reads aloud — so text and voice stay in lockstep.
   ========================================================================== */

import type { ActivityConfig, ActivityGoal } from '../types';
import type { TinaAvatarState } from '../components/TinaAvatar';

export interface OnboardingStep {
    id: string;
    avatarState: TinaAvatarState;
    /** Short heading shown above the narration (optional). */
    title?: string;
    /** The narration text — also the unit a voice layer would speak. */
    body: string;
    /** 'scenario' renders as a highlighted situation card; default 'message'. */
    variant?: 'message' | 'scenario';
    /** Button label to advance; the last step uses this to enter the chat. */
    cta: string;
}

// One concrete, relatable scenario per activity goal. Each models a small,
// honest tension between AI's convenience and a teacher's values/identity —
// the exact territory TINA reflects on.
const SCENARIO_BY_GOAL: Record<ActivityGoal, string> = {
    reflection:
        'Imagine you just used ChatGPT to plan tomorrow\'s lesson. It saved you a full hour, but you\'re not totally sure you\'d admit that to a colleague.',
    'case-analysis':
        'Imagine a colleague shows you an essay an AI flagged as "likely AI-written" — from a student you genuinely trust. The grade is due tomorrow.',
    'lesson-design':
        'Imagine AI drafted a whole lesson in seconds. It\'s honestly good. But you realize you didn\'t make a single teaching choice in it yourself.',
    'ethics-decision':
        'Imagine a student used AI on a take-home task. Your school has no rule that covers this yet, and you have to decide what\'s fair by tomorrow.',
    'feedback-revision':
        'Imagine AI wrote feedback for 30 essays in under a minute. It\'s polite and detailed, yet none of it sounds like you.',
};

function scenarioForActivity(config: ActivityConfig | null | undefined): string {
    const goal: ActivityGoal = config?.activityGoal || 'reflection';
    let scenario = SCENARIO_BY_GOAL[goal] || SCENARIO_BY_GOAL.reflection;
    const topic = config?.topic?.trim();
    if (topic) {
        scenario += ` This connects to what you'll reflect on today: ${topic}.`;
    }
    return scenario;
}

/**
 * buildOnboardingScript — PURE. Returns the ordered narration steps. Safe to
 * call with a null config (falls back to the generic reflection scenario).
 */
export function buildOnboardingScript(config: ActivityConfig | null | undefined): OnboardingStep[] {
    const learnerWord =
        config?.learnerLevel === 'graduate' ? 'your practice'
        : config?.learnerLevel === 'practicum-ready' ? 'your practicum'
        : 'your teaching';

    return [
        {
            id: 'welcome',
            avatarState: 'walking',
            title: 'Hi, I\'m TINA',
            body: `I\'m your reflective learning companion. Before we start, let me show you how this works. It only takes a moment.`,
            cta: 'Show me',
        },
        {
            id: 'scenario',
            avatarState: 'thinking',
            title: 'A moment like this',
            body: scenarioForActivity(config),
            variant: 'scenario',
            cta: 'That feels familiar',
        },
        {
            id: 'how-it-works',
            avatarState: 'thinking',
            title: 'What we\'ll do',
            body: `In about 10 minutes, I\'ll ask a few short questions to help you notice what really matters to you in ${learnerWord}, and how AI is shaping it. I\'m not analyzing or scoring you.`,
            cta: 'Got it',
        },
        {
            id: 'how-to-engage',
            avatarState: 'listening',
            title: 'How to get the most from it',
            body: `There are no right answers here. Think of me as a mirror, not a judge. Short, honest replies work best, and even "I\'m not sure" is a great place to start.`,
            cta: 'I\'m ready',
        },
        {
            id: 'handoff',
            avatarState: 'idle',
            title: 'Let\'s begin',
            body: `Whenever you\'re ready, we\'ll start with whatever is actually on your mind right now. Take your time.`,
            cta: 'Start my reflection',
        },
    ];
}

/** Stable per-user localStorage key for the "has seen onboarding" flag. */
export function onboardingSeenKey(userId: string | null | undefined): string {
    return `tina-onboarded-${userId || 'anon'}`;
}
