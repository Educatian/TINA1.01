/* ============================================================================
   TINA — DISCOURSE TURN PAIRING (pure, no DOM/network — testable)

   For discourse analysis the unit of record is the adjacency pair around each
   learner turn: the AI utterance the learner was responding to, the learner's
   response (with its provenance — typed, voice-dictated, or a clicked
   quick-reply option), and the AI reply that followed. coaching_turns keeps
   the move-layer control signals; discourse_turns (tina-discourse.sql) keeps
   the utterance pairs. The two join on (session_id, turn_index).

   This module only BUILDS the row; persistence lives in analyticsService
   (saveDiscourseTurn) with the usual feature-detect/no-op degradation.
   ========================================================================== */

import type { Message } from '../types';

export type UserMessageSource = 'typed' | 'voice' | 'quick_reply';

/** Provenance attached to a learner message at the moment it is produced. */
export interface UserMessageMeta {
    source: UserMessageSource;
    quickReply?: {
        questionId: string;
        optionId: string;
        questionText: string;
    };
}

export interface DiscourseTurnRow {
    session_id: string;
    user_id: string;
    activity_id: string | null;
    turn_index: number;
    /** The AI utterance the learner was responding to (null only if none preceded). */
    ai_prompt_text: string | null;
    user_text: string;
    user_source: UserMessageSource;
    qr_question_id: string | null;
    qr_option_id: string | null;
    qr_question_text: string | null;
    /** TINA's reply to this learner turn. */
    ai_response_text: string;
    /** Coaching move that shaped the reply (null on control arm / engine off). */
    move: string | null;
}

/** Last model utterance before the learner spoke — the prompting side of the pair. */
export function findAiPrompt(priorMessages: Message[]): string | null {
    for (let i = priorMessages.length - 1; i >= 0; i--) {
        const msg = priorMessages[i];
        if (msg.role === 'model' && msg.text.trim()) return msg.text;
    }
    return null;
}

export function buildDiscourseTurn(input: {
    sessionId: string;
    userId: string;
    activityId?: string | null;
    turnIndex: number;
    priorMessages: Message[];
    userMsg: Message;
    aiResponseText: string;
    move?: string | null;
}): DiscourseTurnRow {
    const meta = input.userMsg.quickReply;
    return {
        session_id: input.sessionId,
        user_id: input.userId,
        activity_id: input.activityId ?? null,
        turn_index: input.turnIndex,
        ai_prompt_text: findAiPrompt(input.priorMessages),
        user_text: input.userMsg.text,
        user_source: input.userMsg.source ?? 'typed',
        qr_question_id: meta?.questionId ?? null,
        qr_option_id: meta?.optionId ?? null,
        qr_question_text: meta?.questionText ?? null,
        ai_response_text: input.aiResponseText,
        move: input.move ?? null,
    };
}

/** Stamp provenance + turn alignment onto a learner message (returns a new object). */
export function withProvenance(msg: Message, turnIndex: number, meta?: UserMessageMeta): Message {
    return {
        ...msg,
        turnIndex,
        source: meta?.source ?? 'typed',
        ...(meta?.quickReply ? { quickReply: meta.quickReply } : {}),
    };
}
