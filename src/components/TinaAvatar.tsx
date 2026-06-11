import React from 'react';

/* ============================================================================
   TinaAvatar — full-body TINA character states (Higgsfield-generated pose set
   in public/avatar-states/, character-matched to the original tina-avatar.png).

   Design principle: this is a quiet reflection space, so motion stays calm —
   slow CSS micro-animations only, paused entirely under
   prefers-reduced-motion (see .tina-avatar rules in index.css).

   The coaching engine's move IS the expression driver: the same deterministic
   signal that shapes the LLM reply also picks the avatar's stance.
   ========================================================================== */

export type TinaAvatarState = 'idle' | 'thinking' | 'listening' | 'walking' | 'celebrating';

const STATE_ALT: Record<TinaAvatarState, string> = {
    idle: 'TINA standing ready',
    thinking: 'TINA thinking',
    listening: 'TINA listening attentively',
    walking: 'TINA walking',
    celebrating: 'TINA celebrating your reflection',
};

/** Map a coaching move to the avatar stance shown while TINA replies. */
export function avatarStateForMove(move: string | null | undefined): TinaAvatarState {
    switch (move) {
        case 'DEEPEN_REFLECTION':
        case 'NAME_ESSENTIAL':
        case 'REFRAME_PERSPECTIVE':
        case 'SCAFFOLD_WITH_STEM':
            return 'thinking';
        case 'ELICIT_EXPERIENCE':
        case 'LOOK_BACK':
        case 'AFFIRM_AND_HOLD':
            return 'listening';
        case 'CLOSE_SYNTHESIS':
            return 'celebrating';
        default:
            return 'idle';
    }
}

interface TinaAvatarProps {
    state: TinaAvatarState;
    /** CSS height, e.g. 96 (px). Width follows the image's aspect ratio. */
    height?: number;
    className?: string;
}

export function TinaAvatar({ state, height = 96, className = '' }: TinaAvatarProps) {
    return (
        <img
            src={`/avatar-states/tina-${state}.png`}
            alt={STATE_ALT[state]}
            className={`tina-avatar tina-avatar-${state} ${className}`.trim()}
            style={{ height: `${height}px`, width: 'auto' }}
            draggable={false}
        />
    );
}
