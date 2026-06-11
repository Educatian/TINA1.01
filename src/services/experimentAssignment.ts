/* ============================================================================
   TINA — EXPERIMENT ASSIGNMENT (coaching-engine A/B condition)

   The whole coaching-move layer is already behind one flag, which makes it a
   ready-made experimental manipulation: treatment = engine ON (deterministic
   ALACT moves steer the LLM), control = engine OFF (the same TINA persona +
   analytics + research extraction, but no move directives). This module turns
   that flag into a proper assignment so a study can compare reflection
   trajectories between arms.

   MODE comes from VITE_COACHING_ENGINE (default 'on' = today's behavior):
     'on'   -> everyone TREATMENT   (unchanged default; live class never regresses)
     'off'  -> everyone CONTROL
     'rct'  -> deterministic 50/50 split, bucketed by a stable hash of user.id
               (same learner always lands in the same arm across sessions)

   The assignment is PURE + deterministic (no Math.random), so it is stable
   across reloads and reproducible offline for analysis.
   ========================================================================== */

export type ExperimentCondition = 'treatment' | 'control';
export type ExperimentMode = 'on' | 'off' | 'rct';

export const EXPERIMENT_ASSIGNMENT_VERSION = 'tina-coaching-rct-v1';

export function getExperimentMode(): ExperimentMode {
    const raw = String((import.meta as any).env?.VITE_COACHING_ENGINE ?? 'on').toLowerCase();
    if (raw === 'off') return 'off';
    if (raw === 'rct') return 'rct';
    return 'on';
}

/** FNV-1a 32-bit — small, stable, dependency-free; ample for 50/50 bucketing. */
export function hashToUnitInterval(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    // >>> 0 -> unsigned; divide by 2^32 for a stable value in [0, 1).
    return (h >>> 0) / 0x100000000;
}

export interface ExperimentAssignment {
    condition: ExperimentCondition;
    mode: ExperimentMode;
    /** TRUE when the coaching-move engine should run for this learner. */
    engineEnabled: boolean;
    assignmentVersion: string;
}

export function assignCondition(userId: string | null | undefined): ExperimentAssignment {
    const mode = getExperimentMode();
    let condition: ExperimentCondition;
    if (mode === 'on') {
        condition = 'treatment';
    } else if (mode === 'off') {
        condition = 'control';
    } else {
        // rct: stable per-user 50/50 split. Salt with the version so a future
        // re-randomization is a clean, documented change rather than silent.
        const bucket = hashToUnitInterval(`${EXPERIMENT_ASSIGNMENT_VERSION}:${userId || 'anon'}`);
        condition = bucket < 0.5 ? 'control' : 'treatment';
    }
    return {
        condition,
        mode,
        engineEnabled: condition === 'treatment',
        assignmentVersion: EXPERIMENT_ASSIGNMENT_VERSION,
    };
}
