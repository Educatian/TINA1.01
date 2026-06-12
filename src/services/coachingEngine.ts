/* ============================================================================
   TINA — COACHING ENGINE (PURE TypeScript, NO LLM, unit-tested)

   The single design spine: a "coaching move" is BOTH
     (a) the control signal that shapes TINA's next LLM turn, AND
     (b) the logged research event.
   One move vocabulary is shared by the selector, the renderer directive,
   the per-turn logger (analyticsService), and the AdminDashboard panels.

   The LLM is ONLY a RENDERER. Move CLASSIFICATION, SELECTION, and
   VERIFICATION live here, in code (the proven sail-me pattern:
   classify -> deterministic select -> verify). The big TINA persona /
   system prompt is preserved untouched; we only inject a short directive.

   ---------------------------------------------------------------------------
   THEORY ANCHORS
   ---------------------------------------------------------------------------
   Korthagen's ALACT reflection cycle (Korthagen & Vasalos, 2005;
   Korthagen, 1985, 2004):
     A  = Action
     L  = Looking back on the action
     A  = Awareness of essential aspects
     C  = Creating alternative methods of action
     T  = Trial
   The session walks the cycle: surface an Action, Look back on it, reach
   Awareness of the essential identity/value/AI tension underneath, Create
   alternatives / reframe, then commit to a Trial, and synthesize.

   Reflection LEVELS (Van Manen, 1977; Korthagen & Wubbels, 1995;
   Hatton & Smith, 1995): technical -> descriptive/practical -> critical.
   The classifier maps each learner turn to one of these levels; when a turn
   stays shallow (technical/descriptive) on an essential matter, the selector
   pushes DEEPEN_REFLECTION to move it toward the critical level.

   Each MOVE below documents its ALACT phase + the reflection level it serves.
   The taxonomy is the SINGLE SOURCE OF TRUTH (exported const + union type).
   ========================================================================== */

// --------------------------------------------------------------------------
// 1) MOVE TAXONOMY (single source of truth)
// --------------------------------------------------------------------------

export const ALACT_PHASES = [
  'action',        // A  — surface a concrete teaching moment
  'looking_back',  // L  — what happened, what was felt/thought/wanted
  'awareness',     // A  — the essential aspect: identity/value/AI tension
  'alternatives',  // C  — create alternative framings / methods of action
  'trial',         // T  — commit to a small next move to try
  'closing',       // synthesis / report
] as const;
export type AlactPhase = (typeof ALACT_PHASES)[number];

export const REFLECTION_LEVELS = ['technical', 'descriptive', 'critical'] as const;
export type ReflectionLevel = (typeof REFLECTION_LEVELS)[number];

export const CONTENT_TAGS = ['identity', 'ai-use', 'ai-society', 'affect'] as const;
export type ContentTag = (typeof CONTENT_TAGS)[number];

// Demonstrated reflective maturity carried in from the learner's PRIOR sessions
// (computed in reflectionScoring.reflectorLevelFromHistory). Drives faded
// scaffolding in selectMove. 'developing' is the neutral default = today's
// behavior, used whenever there is no history signal.
export type ReflectorLevel = 'novice' | 'developing' | 'advanced';

/**
 * The fixed move set. The selector NEVER invents a move outside this object.
 * Each move records its ALACT phase anchor, the reflection level it serves,
 * and a short renderer `directive` injected into the LLM turn (the LLM is the
 * renderer; this directive constrains it without replacing the TINA persona).
 */
export const MOVES = {
  ELICIT_EXPERIENCE: {
    phase: 'action',
    level: 'descriptive',
    desc: 'ALACT Action — surface ONE concrete teaching moment to reflect on',
    directive:
      'COACHING MOVE = ELICIT_EXPERIENCE. Invite the learner to name ONE concrete, recent teaching moment (a real situation, lesson, or AI-use episode) to anchor the reflection. Ask a single short question. Do not give advice.',
  },
  LOOK_BACK: {
    phase: 'looking_back',
    level: 'descriptive',
    desc: 'ALACT Looking back — what happened, what was wanted/felt/thought/done',
    directive:
      'COACHING MOVE = LOOK_BACK. Mirror the essence of what the learner just said in 1 sentence, then ask ONE question that helps them look back at that moment: what they wanted, thought, felt, or did. Stay descriptive; do not interpret for them.',
  },
  NAME_ESSENTIAL: {
    phase: 'awareness',
    level: 'critical',
    desc: 'ALACT Awareness — name the identity/value/AI tension under the moment',
    directive:
      'COACHING MOVE = NAME_ESSENTIAL. Gently surface the essential aspect underneath the moment: a teacher-identity value, a belief-vs-practice tension, or an AI-use/AI-society tension. Offer it tentatively ("it sounds like X might matter to you here") and ask the learner to confirm or correct. One question only.',
  },
  DEEPEN_REFLECTION: {
    phase: 'awareness',
    level: 'critical',
    desc: 'Push descriptive/technical -> critical when a turn stays shallow',
    directive:
      'COACHING MOVE = DEEPEN_REFLECTION. The learner stayed surface-level. Without judging, invite them one layer deeper: ask WHY it matters, what assumption or value sits under it, or what is at stake. One short probing question. Do not supply the answer or lecture.',
  },
  SCAFFOLD_WITH_STEM: {
    phase: 'awareness',
    level: 'critical',
    desc: 'Scaffold a repeatedly-shallow learner with a sentence stem (no more open why-probes)',
    directive:
      'COACHING MOVE = SCAFFOLD_WITH_STEM. The learner has stayed surface-level for more than one turn, so another open "why" question would likely stall them. Offer ONE short sentence stem that fits their last message for them to complete in their own words (for example: "What made that moment matter to me was ___" or "If I am honest, I rely on AI here because ___"). Then ask ONE short question inviting them to finish the stem. No advice, no multiple stems.',
  },
  REFRAME_PERSPECTIVE: {
    phase: 'alternatives',
    level: 'critical',
    desc: 'ALACT Creating alternatives — offer/invite an alternative framing',
    directive:
      'COACHING MOVE = REFRAME_PERSPECTIVE. Invite an alternative perspective on the moment (a student\'s view, a colleague\'s, an equity/access lens, or a different framing of the AI tension). Pose it as a question that opens options, not as a recommendation.',
  },
  CONNECT_VALUE_TO_ACTION: {
    phase: 'trial',
    level: 'critical',
    desc: 'ALACT Trial — connect the named value to one small next move to try',
    directive:
      'COACHING MOVE = CONNECT_VALUE_TO_ACTION. Help the learner connect the value/tension they surfaced to ONE small, concrete next move they could try in a real class, practicum, or planning task. Ask them to name it; do not prescribe it for them.',
  },
  AFFIRM_AND_HOLD: {
    phase: 'looking_back',
    level: 'descriptive',
    desc: 'Validate + hold a safe, low-confusion space (affect / hesitation)',
    directive:
      'COACHING MOVE = AFFIRM_AND_HOLD. The learner sounds hesitant, uncertain, or affectively loaded. Briefly validate the feeling and reduce pressure, then ask ONE gentle, low-stakes question to keep the space open. Warmth over depth this turn.',
  },
  CLOSE_SYNTHESIS: {
    phase: 'closing',
    level: 'critical',
    desc: 'End-of-session synthesis / TINA Reflection Report',
    directive:
      'COACHING MOVE = CLOSE_SYNTHESIS. The session is near its time/turn limit. Produce the closing TINA Reflection Report exactly in the format defined in your system instruction, using tendency/observation language. Do not ask a new question.',
  },
} as const;

export type CoachingMove = keyof typeof MOVES;

export const MOVE_NAMES = Object.keys(MOVES) as CoachingMove[];

// --------------------------------------------------------------------------
// 2) CLASSIFY  — deterministic, lightweight heuristics (NO LLM)
// --------------------------------------------------------------------------

export interface ClassifiedTurn {
  reflectionLevel: ReflectionLevel;
  contentTags: ContentTag[];
  cues: {
    shallow: boolean;       // technical/descriptive on an essential matter
    affect: boolean;        // hesitation / uncertainty / emotional load
    concreteExample: boolean; // mentions a specific teaching moment
    critical: boolean;      // shows critical-level markers (why/assumption/tension)
    wordCount: number;
  };
  /**
   * Conversational-uptake context (Demszky et al. 2021: a quality tutor turn
   * visibly builds on the student's previous turn; AutoTutor's LSA
   * "good-answerness" analog for engagement with the pending question).
   */
  uptake: {
    /** Salient quotable phrase from THIS learner turn (their own words). */
    anchor: string | null;
    /** The question TINA last asked — what the learner was responding to. */
    lastAiQuestion: string | null;
    /**
     * True when a SUBSTANTIVE learner turn shares no content words with the
     * pending question: the learner stepped onto a new thread (off-track).
     */
    digression: boolean;
  };
}

const norm = (s: string): string =>
  (s || '').toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

// content-tag lexicons (kept small + aligned with the existing 3-layer prompt)
const IDENTITY_CUES = [
  'value', 'identity', 'believe', 'belief', 'who i am', 'role', 'philosophy',
  'care', 'equity', 'fairness', 'autonomy', 'i am a', 'as a teacher', 'i want to be',
];
const AI_USE_CUES = [
  'ai', 'chatgpt', 'gemini', 'tool', 'prompt', 'generate', 'lesson plan', 'grading',
  'feedback', 'i use', 'i used', 'rubric', 'draft', 'automate',
];
const AI_SOCIETY_CUES = [
  'society', 'ethic', 'policy', 'bias', 'access', 'divide', 'inequal', 'inequit',
  'transparen', 'privacy', 'power', 'who decides', 'plagiar', 'cheat', 'trust',
];
const AFFECT_CUES = [
  'worried', 'worry', 'anxious', 'afraid', 'nervous', 'unsure', 'not sure',
  'confused', 'overwhelm', 'frustrat', 'guilty', 'uncomfortable', 'scared',
  'i feel', 'feeling', 'stress', 'hesitant', 'conflicted',
];
const HEDGES = ['i think', 'maybe', 'i guess', 'probably', 'kind of', 'sort of', 'not sure'];

// critical-level markers: reasons, assumptions, tensions, stance toward "why"
const CRITICAL_CUES = [
  'because', 'why', 'assum', 'tension', 'contradic', 'on the other hand', 'but i',
  'reconcile', 'trade off', 'tradeoff', 'whose', 'should we', 'what if', 'the reason',
  'it depends', 'in a way', 'really about', 'underneath', 'at stake',
];
// descriptive-level markers: narration of what happened
const DESCRIPTIVE_CUES = [
  'i did', 'i used', 'i told', 'i asked', 'we did', 'they', 'the students', 'in my class',
  'last week', 'yesterday', 'happened', 'when i', 'i tried', 'i had',
];
// concrete-example markers
const EXAMPLE_CUES = [
  'in my class', 'my student', 'a student', 'last week', 'yesterday', 'this morning',
  'lesson', 'one time', 'for example', 'recently', 'the other day', 'when i taught',
];

function countHits(text: string, lexicon: string[]): number {
  return lexicon.reduce((n, kw) => (text.includes(kw) ? n + 1 : n), 0);
}

// --------------------------------------------------------------------------
// 2b) UPTAKE + ALIGNMENT — pure lexical machinery for conversational grounding
// --------------------------------------------------------------------------
// Theory anchors:
//  - Conversational uptake (Demszky et al., 2021): tutor turns that restate/
//    reference the student's previous contribution predict quality; recent
//    LLM-tutor training work optimizes this metric directly.
//  - AutoTutor (Graesser et al.): assesses each student answer against the
//    pending expectation via lexical/LSA overlap before choosing the next
//    dialogue move — never advances the script on a non-engaging answer.
//  - Stepwise topic transition (conversation analysis, Jefferson/Sacks):
//    natural conversations shift topics by PIVOTING off the prior topic
//    ("speaking of X …"), not by boundaried jumps — the bridge directive
//    renders an off-track turn this way instead of ignoring it.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'so', 'if', 'then', 'than', 'that', 'this', 'these', 'those',
  'i', 'me', 'my', 'mine', 'we', 'our', 'us', 'you', 'your', 'yours', 'he', 'she', 'it', 'its', 'they',
  'them', 'their', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'doing',
  'have', 'has', 'had', 'having', 'will', 'would', 'can', 'could', 'should', 'shall', 'may', 'might',
  'must', 'not', 'no', 'yes', 'yeah', 'okay', 'ok', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'into', 'over', 'under', 'from', 'up', 'down', 'out', 'off', 'as', 'too', 'very', 'just',
  'also', 'there', 'here', 'when', 'where', 'what', 'which', 'who', 'whom', 'how', 'why', 'all', 'any',
  'some', 'more', 'most', 'other', 'such', 'only', 'own', 'same', 'few', 'both', 'each', 'because',
  'while', 'during', 'before', 'after', 'again', 'once', 'really', 'well', 'kind', 'sort', 'thing',
  'things', 'stuff', 'lot', 'bit', 'way', 'like', 'get', 'got', 'go', 'going', 'know', 'think', 'guess',
  'maybe', 'something', 'anything', 'everything', 'someone', 'dont', "don't", 'im', "i'm", 'ive', "i've",
  'its', "it's", 'thats', "that's", 'one', 'two', 'much', 'many', 'still', 'even', 'now', 'time',
]);

/** Content words of an utterance: normalized, stopwords removed, length >= 3. */
export function contentWords(text: string): string[] {
  return norm(text).split(' ').filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

// Cheap stemming for overlap ("grading"/"graded" -> "grad", "essays" -> "essay").
function lightStem(w: string): string {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && (w.endsWith('ed') || w.endsWith('es'))) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

function fuzzyEquals(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = lightStem(a);
  const sb = lightStem(b);
  if (sa === sb) return true;
  if (sa.length < 4 || sb.length < 4) return false;
  return sa.startsWith(sb) || sb.startsWith(sa);
}

/** Count of content words the two utterances share (fuzzy-stemmed). */
export function sharedContentCount(a: string, b: string): number {
  const wa = contentWords(a);
  const wb = contentWords(b);
  return wa.filter((x) => wb.some((y) => fuzzyEquals(x, y))).length;
}

/**
 * The question TINA last asked: the LAST question-sentence of the most recent
 * model message. This is what the learner's current turn is (or is not)
 * responding to. Null when no model message asked anything.
 */
export function lastAiQuestionFrom(history: { role: string; text: string }[]): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'model' || !(m.text || '').trim()) continue;
    const sentences = m.text.match(/[^.!?]*\?/g);
    if (!sentences) return null;
    const last = sentences[sentences.length - 1].trim();
    return last.length >= 8 ? last : null;
  }
  return null;
}

const MAX_ANCHOR_CHARS = 60;

/**
 * extractUptakeAnchor — PURE. Picks the most salient quotable phrase from the
 * learner's utterance (their OWN words) so directives can instruct the
 * renderer to visibly take it up. Clause with the densest content (substance
 * lexicon hits weigh double), trimmed to a quotable length.
 */
export function extractUptakeAnchor(text: string): string | null {
  const clauses = (text || '').split(/[.!?;,\n]+/).map((c) => c.trim()).filter(Boolean);
  let best: { clause: string; score: number } | null = null;
  for (const clause of clauses) {
    const words = contentWords(clause);
    if (words.length < 2) continue;
    const t = norm(clause);
    const lexHits =
      countHits(t, IDENTITY_CUES) + countHits(t, AI_USE_CUES) +
      countHits(t, AI_SOCIETY_CUES) + countHits(t, CRITICAL_CUES);
    const score = words.length + lexHits * 2;
    if (!best || score > best.score) best = { clause, score };
  }
  if (!best) return null;
  let anchor = best.clause;
  if (anchor.length > MAX_ANCHOR_CHARS) {
    const cut = anchor.slice(0, MAX_ANCHOR_CHARS);
    anchor = `${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : MAX_ANCHOR_CHARS)}…`;
  }
  return anchor;
}

// A digression must be a SUBSTANTIVE turn — short answers ("ok", "I guess")
// are minimal/shallow turns, already handled by the depth logic, not topic shifts.
const DIGRESSION_MIN_WORDS = 8;

/**
 * assessUptake — PURE. Computes the uptake context for a learner turn against
 * the conversation history: their quotable anchor, the pending TINA question,
 * and whether this substantive turn disengaged from it (digression).
 */
export function assessUptake(
  text: string,
  history: { role: string; text: string }[],
): ClassifiedTurn['uptake'] {
  const anchor = extractUptakeAnchor(text);
  const lastAiQuestion = lastAiQuestionFrom(history);
  const wordCount = norm(text).split(' ').filter(Boolean).length;
  const digression = Boolean(
    lastAiQuestion &&
    anchor &&
    wordCount >= DIGRESSION_MIN_WORDS &&
    sharedContentCount(text, lastAiQuestion) === 0,
  );
  return { anchor, lastAiQuestion, digression };
}

/**
 * classifyTurn — pure. Maps a learner utterance (+ optional recent history)
 * to {reflectionLevel, contentTags, cues} using lightweight lexical heuristics.
 * No network, no LLM. Safe to run synchronously before every turn.
 */
export function classifyTurn(text: string, history: { role: string; text: string }[] = []): ClassifiedTurn {
  const t = norm(text);
  const wordCount = t ? t.split(' ').filter(Boolean).length : 0;

  const identityHits = countHits(t, IDENTITY_CUES);
  const aiUseHits = countHits(t, AI_USE_CUES);
  const aiSocietyHits = countHits(t, AI_SOCIETY_CUES);
  // Genuine affect needs a real emotion/uncertainty word. Hedging alone
  // ("i think", "maybe") is ordinary academic speech and must NOT trigger
  // holding moves on plain descriptive turns; two or more hedges in one turn
  // still reads as real hesitation.
  const emotionHits = countHits(t, AFFECT_CUES);
  const hedgeHits = HEDGES.filter((h) => t.includes(h)).length;
  const affectHits = emotionHits >= 1 || hedgeHits >= 2 ? emotionHits + hedgeHits : 0;

  const criticalHits = countHits(t, CRITICAL_CUES);
  const descriptiveHits = countHits(t, DESCRIPTIVE_CUES);
  const exampleHits = countHits(t, EXAMPLE_CUES);

  const contentTags: ContentTag[] = [];
  if (identityHits > 0) contentTags.push('identity');
  if (aiUseHits > 0) contentTags.push('ai-use');
  if (aiSocietyHits > 0) contentTags.push('ai-society');
  if (affectHits > 0) contentTags.push('affect');

  // reflection level:
  //  - critical: shows reasoning/assumption/tension markers
  //  - descriptive: narrates a concrete experience without critical markers
  //  - technical: very short or generic, neither narration nor reasoning
  let reflectionLevel: ReflectionLevel;
  if (criticalHits >= 1 && wordCount >= 8) {
    reflectionLevel = 'critical';
  } else if ((descriptiveHits >= 1 || exampleHits >= 1) && wordCount >= 5) {
    reflectionLevel = 'descriptive';
  } else {
    reflectionLevel = 'technical';
  }

  // "shallow" = the turn is technical, OR descriptive but with no critical depth
  // on a substantive matter. Used to trigger DEEPEN_REFLECTION.
  const shallow = reflectionLevel === 'technical' || (reflectionLevel === 'descriptive' && criticalHits === 0);

  return {
    reflectionLevel,
    contentTags,
    cues: {
      shallow,
      affect: affectHits > 0,
      concreteExample: exampleHits > 0,
      critical: criticalHits >= 1,
      wordCount,
    },
    uptake: assessUptake(text, history),
  };
}

// --------------------------------------------------------------------------
// 3) SELECT  — deterministic move selection (NO LLM). One move per turn.
// --------------------------------------------------------------------------

export interface CoachingState {
  /** ALACT phase the session is currently in. */
  phase: AlactPhase;
  /** TINA response index already taken (1-based, like turnCount). */
  turnIndex: number;
  /** Max model turns for this session (TINA uses 12 ~ 10 min). */
  maxTurns: number;
  /** Wall-clock ms elapsed since session start (optional; turn-based fallback). */
  elapsedMs?: number;
  /** Target session length in ms (~10 min). */
  budgetMs?: number;
  /** Classification of the learner turn we are about to respond to. */
  classified: ClassifiedTurn;
  /** Consecutive shallow learner turns BEFORE the current one (caller-tracked). */
  consecutiveShallow?: number;
  /** Content tags that have surfaced at any point this session (caller-tracked). */
  coveredTags?: ContentTag[];
  /**
   * Demonstrated reflective maturity from the learner's prior sessions. Fades
   * scaffolding: 'advanced' learners get a later, lighter stem and briefer
   * probes; 'novice' learners get earlier, warmer support. Omitted/'developing'
   * = today's behavior.
   */
  reflectorLevel?: ReflectorLevel;
}

export interface SelectedMove {
  move: CoachingMove;
  directive: string;
  nextPhase: AlactPhase;
  reason: string;
}

const DEFAULT_BUDGET_MS = 10 * 60 * 1000; // 10 minutes

// natural ALACT progression used when no special cue overrides it
const PHASE_ORDER: AlactPhase[] = ['action', 'looking_back', 'awareness', 'alternatives', 'trial', 'closing'];
const PHASE_TO_MOVE: Record<AlactPhase, CoachingMove> = {
  action: 'ELICIT_EXPERIENCE',
  looking_back: 'LOOK_BACK',
  awareness: 'NAME_ESSENTIAL',
  alternatives: 'REFRAME_PERSPECTIVE',
  trial: 'CONNECT_VALUE_TO_ACTION',
  closing: 'CLOSE_SYNTHESIS',
};

function advance(phase: AlactPhase): AlactPhase {
  const i = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER[Math.min(i + 1, PHASE_ORDER.length - 1)];
}

/** Is the session at/over its time-or-turn budget and should close now? */
export function shouldClose(state: CoachingState): boolean {
  const turnsLeft = state.maxTurns - state.turnIndex;
  if (turnsLeft <= 1) return true; // landing slot for the report
  if (typeof state.elapsedMs === 'number') {
    const budget = state.budgetMs ?? DEFAULT_BUDGET_MS;
    if (state.elapsedMs >= budget) return true;
  }
  return false;
}

/**
 * How many consecutive shallow turns before we escalate from an open
 * DEEPEN_REFLECTION probe to a heavier SCAFFOLD_WITH_STEM. Faded by reflector
 * maturity: advanced reflectors get one extra open probe (3); everyone else
 * keeps today's threshold (2).
 */
function scaffoldThreshold(level?: ReflectorLevel): number {
  return level === 'advanced' ? 3 : 2;
}

/**
 * Append a short maturity-aware tone note to a scaffolding directive so the
 * SAME move lands lighter for an advanced reflector and warmer/more concrete
 * for a novice. 'developing' / undefined leave the directive untouched (today's
 * behavior), so the renderer sees no change unless we have a real signal.
 */
function fadeDirective(move: CoachingMove, level?: ReflectorLevel): string {
  const base = MOVES[move].directive;
  if (level === 'advanced') {
    return `${base} This learner has a track record of deep, critical reflection across prior sessions, so keep the prompt brief and peer-to-peer; trust them to go deep with minimal scaffolding and do not over-explain.`;
  }
  if (level === 'novice') {
    return `${base} This learner is early in building reflective habits, so make the prompt concrete, small, and warmly supportive; reduce the cognitive load rather than adding to it.`;
  }
  return base;
}

/**
 * selectMove — PURE. Returns exactly ONE coaching move + its renderer directive
 * + the ALACT phase to advance to. Priority:
 *   1. End of time/turns  -> CLOSE_SYNTHESIS
 *   2. Strong affect/hesitation (not closing) -> AFFIRM_AND_HOLD (hold the space)
 *   3. Substantive off-track turn -> hold the phase, bridge stepwise back
 *   4. Shallow turn while we need awareness:
 *        first shallow turn      -> DEEPEN_REFLECTION (open why-probe)
 *        2+ consecutive shallow  -> SCAFFOLD_WITH_STEM (sentence stem; repeated
 *                                   open probing without scaffolding stalls
 *                                   shallow reflectors instead of deepening them)
 *   5. Otherwise -> the move for the current ALACT phase, then advance.
 */
export function selectMove(state: CoachingState): SelectedMove {
  const mk = (move: CoachingMove, nextPhase: AlactPhase, reason: string, directive?: string): SelectedMove => ({
    move,
    directive: directive ?? MOVES[move].directive,
    nextPhase,
    reason,
  });

  // 1) Land the close near the end of the budget/turns.
  if (shouldClose(state) || state.phase === 'closing') {
    return mk('CLOSE_SYNTHESIS', 'closing', 'end_of_time_or_turns');
  }

  const c = state.classified;

  // 2) Affect / hesitation gets a holding move, but ONLY when the turn is not
  //    already substantive: if the learner is reasoning at the critical level,
  //    an incidental feeling word should not derail the cycle. Warmth before
  //    depth only when the depth isn't already there.
  const affectNeedsHolding = c.cues.affect && !c.cues.critical;
  if (affectNeedsHolding && state.phase !== 'trial' && state.phase !== 'alternatives') {
    // do NOT advance the phase on a holding turn — stay and stabilize
    return mk('AFFIRM_AND_HOLD', state.phase, 'affect_or_hesitation');
  }

  // 3) Digression — a substantive turn that disengaged from the pending
  //    question (AutoTutor never advances the script on a non-engaging answer;
  //    the conversation-analysis fix is a STEPWISE transition, not a yank).
  //    HOLD the phase and render the current phase's move through a bridge:
  //    take up the new thread in the learner's own words, then pivot back.
  // (the closing case already returned above)
  if (c.uptake.digression) {
    const baseMove = PHASE_TO_MOVE[state.phase];
    const bridge =
      `BRIDGE FIRST: the learner's reply stepped away from your last question onto a new thread ` +
      `("${c.uptake.anchor}"). Do not ignore the new thread, and do not yank the conversation back ` +
      `abruptly. First take up their words — acknowledge the new thread in one warm clause — then ` +
      `pivot back to the reflection focus with a stepwise transition that explicitly links the new ` +
      `thread to it (in the spirit of "speaking of ${c.uptake.anchor}…" / "that connects to…"). ` +
      `Then enact: ${MOVES[baseMove].directive}`;
    // do NOT advance the phase — its material has not been produced yet
    return mk(baseMove, state.phase, 'digression_bridge', bridge);
  }

  // 4) Shallow turn at a phase that REQUIRES depth (reaching awareness or
  //    creating alternatives): push deeper before advancing, so we never move
  //    the cycle forward on thin material. We do NOT deepen at 'action' (we are
  //    still surfacing) or 'looking_back' (description is exactly what we want
  //    there) — only where critical reflection is the goal.
  const depthRequired = state.phase === 'awareness' || state.phase === 'alternatives';
  if (depthRequired && c.cues.shallow) {
    const shallowRun = (state.consecutiveShallow ?? 0) + 1; // incl. current turn
    // Faded scaffolding: the heavy move (a sentence stem) is delayed for a
    // learner with a track record of deep reflection — give them another open
    // probe first — and reached sooner for a novice who needs support earlier.
    const stemAt = scaffoldThreshold(state.reflectorLevel);
    if (shallowRun >= stemAt) {
      return mk(
        'SCAFFOLD_WITH_STEM', state.phase, 'repeated_shallow_needs_scaffold',
        fadeDirective('SCAFFOLD_WITH_STEM', state.reflectorLevel),
      );
    }
    return mk(
      'DEEPEN_REFLECTION', state.phase, 'shallow_turn_needs_depth',
      fadeDirective('DEEPEN_REFLECTION', state.reflectorLevel),
    );
  }

  // 5) Default: the move for the current phase, then advance one step.
  //    Coverage steering (single pacing authority lives HERE, not in the
  //    system prompt's old per-layer turn budget): if the AI-and-society
  //    layer has not surfaced by the time we create alternatives, point the
  //    reframe lens at it so Layer 3 is never silently skipped.
  const move = PHASE_TO_MOVE[state.phase];
  let directive = MOVES[move].directive;
  if (move === 'REFRAME_PERSPECTIVE') {
    const covered = state.coveredTags ?? [];
    const aiSocietySurfaced = covered.includes('ai-society') || c.contentTags.includes('ai-society');
    if (!aiSocietySurfaced) {
      directive +=
        ' For this turn, open the alternative through an AI-and-society lens (equity of access, policy gaps, transparency, or whose knowledge AI represents) — that layer has not yet surfaced in this conversation.';
    }
  }
  return mk(move, advance(state.phase), `alact_${state.phase}`, directive);
}

// --------------------------------------------------------------------------
// 4) VERIFY  — lightweight guard: "mirror, not advisor"
// --------------------------------------------------------------------------

// Prescriptive / advice-giving markers that violate the reflective stance.
const PRESCRIPTIVE_MARKERS = [
  'you should', 'you need to', 'you must', 'i recommend', 'i suggest that you',
  'the best way is', 'you have to', 'make sure you', 'the correct answer is',
  'what you should do is', 'my advice is', 'here are some tips', 'here are some strategies',
  'step 1', 'step 1:', 'firstly,', 'tip:', 'tips:',
];

const QUESTION_MARK = '?';

export interface VerifyResult {
  ok: boolean;
  violations: string[];
}

/**
 * verifyRender — PURE, lightweight. Flags renderer output that broke the
 * "reflective mirror, not advisor" stance for a NON-closing move:
 *   - lectured / gave prescriptive advice instead of reflecting, OR
 *   - asked no question at all (a coaching turn should pose ONE question), OR
 *   - asked multiple questions (the system prompt's ONE-question rule), OR
 *   - (when learnerText is supplied) showed ZERO conversational uptake: the
 *     reply shares no content words at all with the learner's message it is
 *     answering — a disconnected, context-blind turn. Deliberately lenient
 *     (any single shared/fuzzy-stemmed content word passes) so paraphrase
 *     never false-positives; it only catches true non-sequiturs.
 * CLOSE_SYNTHESIS is exempt: the report is declarative by design.
 */
export function verifyRender(move: CoachingMove, llmText: string, learnerText?: string): VerifyResult {
  const violations: string[] = [];
  const text = llmText || '';
  const lower = norm(text);

  if (move === 'CLOSE_SYNTHESIS') {
    // The report should NOT pepper new questions, but it is otherwise declarative.
    return { ok: true, violations };
  }

  // prescriptive / advisor stance
  if (PRESCRIPTIVE_MARKERS.some((m) => lower.includes(m))) {
    violations.push('prescriptive_advice');
  }

  // a reflective coaching turn should ask exactly one question
  const questionCount = (text.match(/\?/g) || []).length;
  if (!text.includes(QUESTION_MARK)) {
    violations.push('no_question');
  } else if (questionCount >= 3) {
    // 2 is tolerated (e.g. a clause + the real question); 3+ is interrogation
    violations.push('too_many_questions');
  }

  // conversational uptake: only judged when the learner turn was substantive
  // enough to have something to take up (>= 4 content words).
  if (learnerText && contentWords(learnerText).length >= 4 && sharedContentCount(text, learnerText) === 0) {
    violations.push('no_uptake');
  }

  return { ok: violations.length === 0, violations };
}

/**
 * regenerationHint — a short instruction appended on a verify failure so the
 * single regeneration pass is nudged back toward the reflective move.
 */
export function regenerationHint(move: CoachingMove, violations: string[]): string {
  const parts = [
    `Your previous reply broke TINA's reflective stance (${violations.join(', ')}).`,
    'Re-answer as a reflective mirror, NOT an advisor: do not give prescriptive advice or steps.',
  ];
  if (violations.includes('no_question')) {
    parts.push('Reflect the learner\'s essence in 1 sentence, then ask exactly ONE short question.');
  }
  if (violations.includes('too_many_questions')) {
    parts.push('Ask exactly ONE question, not several.');
  }
  if (violations.includes('no_uptake')) {
    parts.push('Your reply did not connect to what the learner actually said. Open by explicitly referencing or restating their own words from their last message, THEN ask your one question.');
  }
  parts.push(`Keep enacting the move: ${MOVES[move].directive}`);
  return parts.join(' ');
}

// --------------------------------------------------------------------------
// 5) Evidence grounding for the closing report
// --------------------------------------------------------------------------

/**
 * buildGroundingExcerpts — PURE. Picks the learner's most substantive turns
 * (longest + most critical-level markers) so CLOSE_SYNTHESIS can quote the
 * learner's OWN words instead of free-paraphrasing. Verbatim mirroring is the
 * stronger reflective intervention, and it pins the report to real evidence.
 */
export function buildGroundingExcerpts(
  history: { role: string; text: string }[],
  max = 3,
): string[] {
  const scored = history
    .filter((m) => m.role === 'user')
    .map((m) => {
      const t = norm(m.text);
      const wordCount = t ? t.split(' ').filter(Boolean).length : 0;
      const criticalHits = countHits(t, CRITICAL_CUES);
      return { text: m.text.trim(), score: wordCount + criticalHits * 10 };
    })
    .filter((e) => e.score >= 8); // skip "yes" / "ok" turns
  scored.sort((a, b) => b.score - a.score);
  return scored
    .slice(0, max)
    .map((e) => (e.text.length > 220 ? `${e.text.slice(0, 217)}...` : e.text));
}

// --------------------------------------------------------------------------
// 6) Convenience: derive an initial state + run the full pipeline
// --------------------------------------------------------------------------

export interface RunInput {
  text: string;
  history: { role: string; text: string }[];
  phase: AlactPhase;
  turnIndex: number;
  maxTurns: number;
  elapsedMs?: number;
  budgetMs?: number;
  consecutiveShallow?: number;
  coveredTags?: ContentTag[];
  reflectorLevel?: ReflectorLevel;
}

export interface RunResult extends SelectedMove {
  classified: ClassifiedTurn;
}

/** classify -> select -> ground, in one pure call. Used by ChatInterface per turn. */
export function runCoachingTurn(input: RunInput): RunResult {
  const classified = classifyTurn(input.text, input.history);
  const state: CoachingState = {
    phase: input.phase,
    turnIndex: input.turnIndex,
    maxTurns: input.maxTurns,
    elapsedMs: input.elapsedMs,
    budgetMs: input.budgetMs,
    classified,
    consecutiveShallow: input.consecutiveShallow,
    coveredTags: input.coveredTags,
    reflectorLevel: input.reflectorLevel,
  };
  const selected = selectMove(state);

  // Conversational-uptake grounding: every coaching turn (except the closing
  // report, and except a bridge — which already scripts its own uptake) must
  // visibly build on the learner's actual words, so the reply continues from
  // what they just said instead of issuing the next generic probe.
  let directive = selected.directive;
  if (
    selected.move !== 'CLOSE_SYNTHESIS' &&
    selected.reason !== 'digression_bridge' &&
    classified.uptake.anchor
  ) {
    directive +=
      ` Conversational uptake: open your reply by visibly building on the learner's last message — ` +
      `briefly restate or reference their own words (e.g. "${classified.uptake.anchor}") in your ` +
      `mirroring sentence before your question, so this turn clearly continues from what they just said.`;
  }

  return { ...selected, directive, classified };
}
