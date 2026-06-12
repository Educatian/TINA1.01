/* ============================================================================
   TINA — ARTIFACT-ANCHORED REFLECTION

   The strongest reflection tools (Edthena, TeachFX, IRIS Connect) anchor the
   conversation on a piece of REAL teaching evidence — a video, an audio clip,
   a lesson plan, student work. TINA's coaching is text-only, so this lets the
   learner attach a real teaching artifact to reflect ON: a lesson plan or
   excerpt, a description of student work, the exact AI prompt they used, or a
   link. When set, the artifact becomes the anchor of the reflection: it is
   injected into TINA's turns so she grounds the coaching in its specifics
   instead of reflecting in the abstract.

   Best-effort + feature-detected: persistence to sessions.artifact_context is
   optional (tina-artifact-anchor.sql, written through useSession.saveSessionArtifact).
   The in-session anchoring works even before the column exists; persistence
   just lets a resumed session reload it.

   This module is PURE (no supabase/DOM import) so the directive grammar stays
   unit-testable under `node --test`.
   ========================================================================== */

export type ArtifactKind =
    | 'lesson-plan'
    | 'student-work'
    | 'ai-prompt'
    | 'reflection-note'
    | 'other';

export interface SessionArtifact {
    kind: ArtifactKind;
    /** A paste/description of the artifact (lesson excerpt, student work, prompt). */
    note: string;
    /** Optional link to the artifact (a doc, a shared drive file, a screenshot). */
    link?: string;
}

const KIND_LABELS: Record<ArtifactKind, string> = {
    'lesson-plan': 'a lesson plan or teaching plan',
    'student-work': 'a piece of student work',
    'ai-prompt': 'an AI prompt they actually used',
    'reflection-note': 'a note from their own teaching',
    other: 'a real teaching artifact',
};

export const ARTIFACT_KIND_OPTIONS: { value: ArtifactKind; label: string }[] = [
    { value: 'lesson-plan', label: 'Lesson plan / teaching plan' },
    { value: 'student-work', label: 'Student work' },
    { value: 'ai-prompt', label: 'An AI prompt I used' },
    { value: 'reflection-note', label: 'A note from my teaching' },
    { value: 'other', label: 'Something else' },
];

const MAX_NOTE = 1200;   // stored length cap
const MAX_INJECT = 600;  // per-turn injected excerpt cap (keep turns lean)

/** A non-empty artifact has at least a note or a link. */
export function hasArtifact(a: SessionArtifact | null | undefined): a is SessionArtifact {
    return Boolean(a && ((a.note && a.note.trim()) || (a.link && a.link.trim())));
}

export function normalizeArtifact(input: Partial<SessionArtifact> | null | undefined): SessionArtifact | null {
    if (!input) return null;
    const note = (input.note || '').trim().slice(0, MAX_NOTE);
    const link = (input.link || '').trim().slice(0, 500);
    if (!note && !link) return null;
    const kind = (ARTIFACT_KIND_OPTIONS.some((o) => o.value === input.kind) ? input.kind : 'other') as ArtifactKind;
    return { kind, note, link: link || undefined };
}

/**
 * buildArtifactDirective — PURE. The compact anchor block injected into TINA's
 * turn so she grounds the reflection in the learner's real artifact. Returns ''
 * for an empty artifact (no-op). Coaching stance is preserved: anchor on it,
 * do not evaluate or grade it.
 */
export function buildArtifactDirective(artifact: SessionArtifact | null | undefined): string {
    if (!hasArtifact(artifact)) return '';
    const what = KIND_LABELS[artifact.kind] || KIND_LABELS.other;
    const noteText = artifact.note.trim();
    const excerpt = noteText.length > MAX_INJECT ? `${noteText.slice(0, MAX_INJECT - 3)}...` : noteText;
    const parts = [
        `[ARTIFACT ANCHOR — the learner has attached ${what} to reflect ON.`,
        'Ground your reflection in its concrete specifics (refer to real details from it) rather than reflecting in the abstract.',
        'Do NOT evaluate, grade, or improve the artifact; use it only as the shared object you reflect from. Keep your one-question rule.',
    ];
    if (excerpt) parts.push(`Artifact the learner shared: "${excerpt}".`);
    if (artifact.link) parts.push(`Reference link: ${artifact.link}.`);
    return `${parts.join(' ')}]`;
}

/** Read a persisted artifact off an already-loaded session row (for resume). */
export function getSessionArtifact(session: { artifact_context?: unknown } | null | undefined): SessionArtifact | null {
    if (!session) return null;
    return normalizeArtifact((session as any).artifact_context as Partial<SessionArtifact> | null);
}
