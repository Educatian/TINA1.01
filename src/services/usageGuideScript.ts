/* ============================================================================
   TINA — USAGE GUIDE SCRIPT (PURE, no DOM/LLM)

   An embedded, role-aware "how to use TINA" walkthrough delivered as a narrated
   screencast: each step pairs a real app frame (screenshot) with a short TINA
   narration. Two tracks — one for LEARNERS, one for INSTRUCTORS — because they
   meet the app at different doors.

   Mirrors the onboarding pattern (onboardingScript.ts): each step carries its
   own narration `body`, which is ALSO the exact text spoken by the pre-recorded
   voice clip under /narration/guide/<clipId>.mp3. Text ships today and always
   works; the voice attaches per step when its clip exists. Frames live under
   /guide/<frame>; a missing frame degrades to a captioned icon tile, never a
   broken image.
   ========================================================================== */

export type GuideRole = 'learner' | 'instructor';

export interface GuideStep {
    id: string;
    /** Short heading shown above the narration. */
    title: string;
    /** Narration text — also the exact unit the voice clip speaks. */
    body: string;
    /** Screencast frame under /guide/<frame> (real app screenshot). */
    frame: string;
    /** Emoji/icon shown on the fallback tile if the frame is missing. */
    icon: string;
    /** Pre-recorded narration clip /narration/guide/<clipId>.mp3 (= clipId). */
    clipId: string;
    /** Longer, instructional explanation shown only on the full-page guidebook. */
    detail: string;
}

export const GUIDE_ROLES: { value: GuideRole; label: string; icon: string; blurb: string }[] = [
    { value: 'learner', label: 'For learners', icon: '🧑‍🎓', blurb: 'Take a 10-minute reflective session with TINA.' },
    { value: 'instructor', label: 'For instructors', icon: '👩‍🏫', blurb: 'Set TINA up for your class and read the reflection data.' },
];

/**
 * Canonical narration text per clip — EXACTLY what is sent to TTS / recorded
 * under /narration/guide/<clipId>.mp3, so the voice never diverges from the
 * on-screen text. (Keep these in sync with the generated .mp3 files.)
 */
export const GUIDE_NARRATION_TEXT: Record<string, string> = {
    // ---- learner track ----
    'l-welcome':
        "Welcome. I'm TINA, your reflective learning companion. In about ten minutes, I'll help you notice what really matters to you in your teaching, and how AI is shaping it. I'm not grading you. Let me show you how it works.",
    'l-signin':
        "First, sign in with your email so your reflections are saved privately to you. If your instructor assigned an activity, you'll see it waiting here.",
    'l-start':
        "Then we just talk. Start with one real, recent teaching moment, something that felt important, difficult, or unfinished. Short, honest replies work best, and even 'I'm not sure' is a great place to begin.",
    'l-artifact':
        "If you'd like, anchor our conversation on something real: a lesson plan, a piece of student work, or the exact AI prompt you used. Tap 'Anchor on a real teaching artifact', and I'll ground my questions in it instead of staying abstract.",
    'l-pace':
        "The bar at the top tracks our pace, about twelve short turns. I'll ask one question at a time and mirror back what I hear, so you never feel rushed or tested.",
    'l-report':
        "At the end, I'll give you a reflection report: the values guiding you, your current AI approach, and one small next move to try. It's built from your own words, not a score.",
    'l-return':
        "When you come back, we pick up where you left off. I'll check in on that next move you chose, so each session builds on the last. That's the whole idea.",
    // ---- instructor track ----
    'i-welcome':
        "Here's how you'll use TINA with your class. One shared TINA serves every learner, but you shape the context: the reflection goal, the topic, and what learners produce. Let me walk you through it.",
    'i-signin':
        "Sign in with your instructor account. You'll land on the same TINA, with an authoring header and an admin dashboard that learners never see.",
    'i-author':
        "Create an activity: choose the reflection goal, add a topic, set the learner level, and pick the output format. TINA's coaching adapts to it, while her reflective stance stays the same for everyone.",
    'i-assign':
        "Assign the activity to your learners. When they sign in, your context is already waiting for them, and you can see who has started and who has finished.",
    'i-dashboard':
        "The admin dashboard turns every session into research. You'll see reflection-level distribution, coaching-move usage, each learner's depth trajectory, and how well the automatic classifier agrees with the language model.",
    'i-export':
        "Everything exports as CSV or JSON, and each field is documented for preregistration. You can even run a built-in A B comparison of the coaching engine, with learners split fairly and automatically.",
    'i-feedback':
        "Finally, you can send a short personal note back to any learner on their session, closing the loop between their reflection and your guidance. That's TINA, end to end.",
};

/**
 * Longer, instructional copy for the full-page guidebook only (the modal shows
 * just the narration `body`). Each is a short paragraph that expands on the
 * step with concrete how-to detail.
 */
export const GUIDE_DETAIL_TEXT: Record<string, string> = {
    // ---- learner track ----
    'l-welcome':
        "TINA is a short, conversational reflection, not a test or an assignment you can pass or fail. Over about ten minutes she asks a handful of open questions to help you put words to what matters in your teaching and how AI is shaping it. There is nothing to prepare; you only need a recent experience and a few honest minutes.",
    'l-signin':
        "Use your email to sign in (or create an account in seconds). Your reflections are private to you and stored under your account, so you can come back and continue later. If your instructor has assigned a specific activity, it appears automatically once you sign in, with the topic and goal they set.",
    'l-start':
        "Begin with one concrete, recent teaching moment, ideally something that felt important, difficult, or unfinished. You do not need polished answers: short, honest replies work best, and \"I'm not sure\" is a perfectly good place to start. TINA asks one question at a time and mirrors back what she hears, so the conversation stays focused and unhurried.",
    'l-artifact':
        "Reflection is richer when it sits on real evidence. Tap \"Anchor on a real teaching artifact\" to bring in a lesson plan, a piece of student work, or the exact AI prompt you used (paste text or add a link). TINA then grounds her questions in that artifact instead of staying abstract. It stays pinned for the whole session, and she never grades it; it is just the shared object you reflect from.",
    'l-pace':
        "The bar at the top tracks the conversation's pace, roughly twelve short turns over about ten minutes. There is no penalty for going slowly. TINA keeps to one question per turn and reflects your essence back before asking the next, so you always know she is following you and you never feel rushed or quizzed.",
    'l-report':
        "When the session closes, TINA writes a reflection report built entirely from your own words. It opens with a constellation of the values that guided you and the tension they pulled against, then summarizes your current AI approach and ends with one small next move to try. It is a coaching debrief, not a score, and you can revisit or export it later.",
    'l-return':
        "Each session is meant to build on the last. When you return, TINA opens by checking in on the \"one next move\" you chose, what happened when you tried it, or what got in the way. That turns a single chat into an ongoing cycle, and over time the conversation can ask lighter questions as your reflection deepens.",
    // ---- instructor track ----
    'i-welcome':
        "Every learner talks to the same TINA, but you decide the context she works within: the reflection goal, the topic, the learner level, and what learners produce. Her reflective stance (a warm mirror, never an evaluator) stays constant for everyone, so you get comparable reflection across a class while still aiming it at your specific assignment.",
    'i-signin':
        "Sign in with an instructor account (your email is granted instructor access). You land on the same TINA app, but with two extra surfaces learners never see: an activity-authoring header and the admin dashboard. A \"Learner Test Mode\" toggle lets you preview exactly what students experience.",
    'i-author':
        "In Activity Studio, create an activity and choose its reflection goal (reflection, case analysis, lesson design, ethics decision, or feedback revision), add a topic, set the learner level, and pick the output format. TINA's questions and onboarding adapt to those choices, while the underlying coaching engine and safety rules stay the same.",
    'i-assign':
        "Publish the activity and assign your learners. When they sign in, your context is already waiting for them, so there is no setup on their side. The dashboard then shows who has been assigned, who has started, who has finished, and who may need a follow-up nudge, in real time.",
    'i-dashboard':
        "The dashboard turns every session into research. Overview gives completion and pace; NLP Analytics shows sentiment, emotion, and engagement; Research Signals holds Gemini-extracted reflection depth and ethics/practicum cues; Coaching Moves shows the ALACT-grounded move log and a lexical-vs-Gemini agreement check. Hover any section's ⓘ for what it means.",
    'i-export':
        "Every table exports as CSV or JSON, and each field is documented for preregistration and sharing. A built-in A/B mode can split learners fairly and automatically between the coaching engine on and off, so you can study its effect. Nothing requires leaving the app or touching the database directly.",
    'i-feedback':
        "When a learner asks for feedback, their request appears in the Feedback tab with their session in context. You can read their reflection signals and send a short, personal note back, closing the loop between what they reflected on and your guidance, without breaking TINA's non-evaluative stance inside the chat.",
};

function step(id: string, title: string, frame: string, icon: string): GuideStep {
    return { id, title, body: GUIDE_NARRATION_TEXT[id], frame, icon, clipId: id, detail: GUIDE_DETAIL_TEXT[id] };
}

const LEARNER_STEPS: GuideStep[] = [
    step('l-welcome', "Meet TINA", 'l-welcome.png', '🪞'),
    step('l-signin', "Sign in", 'l-signin.png', '🔐'),
    step('l-start', "Start with a real moment", 'l-start.png', '💬'),
    step('l-artifact', "Anchor on real evidence", 'l-artifact.png', '📎'),
    step('l-pace', "One question at a time", 'l-pace.png', '⏱️'),
    step('l-report', "Your reflection report", 'l-report.png', '📊'),
    step('l-return', "Come back, keep going", 'l-return.png', '🔁'),
];

const INSTRUCTOR_STEPS: GuideStep[] = [
    step('i-welcome', "One TINA, your context", 'i-welcome.png', '🧭'),
    step('i-signin', "Sign in as instructor", 'i-signin.png', '🔐'),
    step('i-author', "Author an activity", 'i-author.png', '✏️'),
    step('i-assign', "Assign to learners", 'i-assign.png', '👥'),
    step('i-dashboard', "Read the dashboard", 'i-dashboard.png', '📈'),
    step('i-export', "Export for research", 'i-export.png', '🧪'),
    step('i-feedback', "Close the loop", 'i-feedback.png', '💌'),
];

/** buildUsageGuide — PURE. Ordered steps for the chosen role track. */
export function buildUsageGuide(role: GuideRole): GuideStep[] {
    return role === 'instructor' ? INSTRUCTOR_STEPS : LEARNER_STEPS;
}

/** Stable localStorage key for "has seen the usage guide" (per role, optional). */
export function usageGuideSeenKey(role: GuideRole): string {
    return `tina-usage-guide-seen-${role}`;
}
