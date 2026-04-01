import { GoogleGenAI } from '@google/genai';
import { supabase } from '../lib/supabase';
import type {
    ActivityConfig,
    Message,
    SessionResearchSummary,
    TurnResearchSignal,
} from '../types';

const TURN_SIGNAL_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: [
        'reflective_depth',
        'uncertainty',
        'ai_stance',
        'critical_evaluation',
        'practicum_linkage',
        'ethical_concern',
        'self_efficacy',
        'next_step_readiness',
    ],
    properties: {
        reflective_depth: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'confidence', 'evidence_span'],
            properties: {
                level: { type: 'string', enum: ['surface', 'emerging', 'developed'] },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        uncertainty: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'types', 'confidence', 'evidence_span'],
            properties: {
                level: { type: 'string', enum: ['low', 'medium', 'high'] },
                types: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['knowledge', 'pedagogical', 'ethical', 'practicum'],
                    },
                },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        ai_stance: {
            type: 'object',
            additionalProperties: false,
            required: ['position', 'confidence', 'evidence_span'],
            properties: {
                position: { type: 'string', enum: ['avoidant', 'cautious', 'pragmatic', 'enthusiastic', 'dependent'] },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        critical_evaluation: {
            type: 'object',
            additionalProperties: false,
            required: ['present', 'moves', 'confidence', 'evidence_span'],
            properties: {
                present: { type: 'boolean' },
                moves: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['questioning_output', 'checking_bias', 'seeking_evidence', 'comparing_alternatives'],
                    },
                },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        practicum_linkage: {
            type: 'object',
            additionalProperties: false,
            required: ['present', 'context', 'confidence', 'evidence_span'],
            properties: {
                present: { type: 'boolean' },
                context: {
                    type: ['string', 'null'],
                    enum: ['lesson planning', 'classroom management', 'assessment', 'feedback', 'ethics', 'general', null],
                },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        ethical_concern: {
            type: 'object',
            additionalProperties: false,
            required: ['present', 'themes', 'confidence', 'evidence_span'],
            properties: {
                present: { type: 'boolean' },
                themes: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['fairness', 'bias', 'privacy', 'transparency', 'student_dependency'],
                    },
                },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        self_efficacy: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'confidence', 'evidence_span'],
            properties: {
                level: { type: 'string', enum: ['low', 'mixed', 'high'] },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
        next_step_readiness: {
            type: 'object',
            additionalProperties: false,
            required: ['level', 'confidence', 'evidence_span'],
            properties: {
                level: { type: 'string', enum: ['not_ready', 'tentative', 'actionable'] },
                confidence: { type: 'number' },
                evidence_span: { type: 'string' },
            },
        },
    },
} as const;

const SESSION_SUMMARY_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    required: [
        'session_arc',
        'dominant_tensions',
        'growth_signals',
        'risk_signals',
        'recommended_support',
        'summary_narrative',
        'overall_confidence',
    ],
    properties: {
        session_arc: {
            type: 'string',
            enum: ['stuck_to_exploratory', 'exploratory_to_actionable', 'consistently_reflective', 'mixed_progression'],
        },
        dominant_tensions: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['efficiency_vs_authenticity', 'innovation_vs_ethics', 'confidence_vs_control', 'support_vs_dependency', 'access_vs_equity'],
            },
        },
        growth_signals: {
            type: 'array',
            items: { type: 'string' },
        },
        risk_signals: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['high_dependency_on_ai', 'low_critical_checking', 'low_practicum_connection', 'persistent_uncertainty', 'ethics_without_action'],
            },
        },
        recommended_support: {
            type: 'array',
            items: {
                type: 'string',
                enum: ['prompt_for_counterexample', 'ask_for_classroom_evidence', 'invite_policy_reflection', 'encourage_small_practicum_experiment', 'surface_equity_tradeoffs'],
            },
        },
        summary_narrative: { type: 'string' },
        overall_confidence: { type: 'number' },
    },
} as const;

const TURN_SIGNAL_MODEL = 'gemini-2.5-flash';
const SESSION_SUMMARY_MODEL = 'gemini-2.5-flash';
const TURN_SIGNAL_PROMPT_VERSION = 'tina-reflection-turn-v1';
const SESSION_SUMMARY_PROMPT_VERSION = 'tina-reflection-session-v1';

function getGeminiApiKey() {
    return (
        (import.meta as any).env?.VITE_GEMINI_API_KEY ||
        (import.meta as any).env?.GEMINI_API_KEY ||
        process.env.API_KEY ||
        process.env.GEMINI_API_KEY ||
        ''
    );
}

function getGeminiClient() {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
        return null;
    }

    return new GoogleGenAI({ apiKey });
}

function clampConfidence(value: unknown) {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (Number.isNaN(numeric)) {
        return 0.5;
    }

    return Math.max(0, Math.min(1, Math.round(numeric * 100) / 100));
}

function normalizeString(value: unknown) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(value: unknown) {
    return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
}

function safeParseJSON<T>(text: string): T | null {
    try {
        return JSON.parse(text) as T;
    } catch (error) {
        console.warn('Failed to parse Gemini research extraction JSON:', error, text);
        return null;
    }
}

function buildActivityContext(activityConfig: ActivityConfig) {
    return [
        `Activity goal: ${activityConfig.activityGoal}`,
        `Learner level: ${activityConfig.learnerLevel}`,
        `Topic: ${activityConfig.topic}`,
        `Course: ${activityConfig.courseName}`,
        `Module: ${activityConfig.moduleLabel}`,
        `Learner description: ${activityConfig.learnerDescription}`,
        activityConfig.scenario ? `Scenario: ${activityConfig.scenario}` : '',
        activityConfig.instructorNote ? `Instructor note: ${activityConfig.instructorNote}` : '',
    ].filter(Boolean).join('\n');
}

function buildTurnReviewMeta(signal: TurnResearchSignal) {
    const reasons: string[] = [];

    const confidenceChecks = [
        signal.reflective_depth.confidence,
        signal.uncertainty.confidence,
        signal.ai_stance.confidence,
        signal.self_efficacy.confidence,
        signal.next_step_readiness.confidence,
    ];

    if (confidenceChecks.some((value) => value < 0.6)) {
        reasons.push('low_confidence_signal');
    }

    if (signal.uncertainty.level === 'high') {
        reasons.push('persistent_uncertainty');
    }

    if (!signal.practicum_linkage.present) {
        reasons.push('missing_practicum_link');
    }

    if (signal.ethical_concern.present && signal.next_step_readiness.level === 'not_ready') {
        reasons.push('ethics_without_action');
    }

    if (signal.ai_stance.position === 'dependent' && !signal.critical_evaluation.present) {
        reasons.push('dependency_without_checking');
    }

    return {
        needsReview: reasons.length > 0,
        reasons,
    };
}

function buildSummaryReviewMeta(summary: SessionResearchSummary) {
    const reasons: string[] = [];

    if (summary.overall_confidence < 0.7) {
        reasons.push('low_summary_confidence');
    }

    if (summary.risk_signals.includes('persistent_uncertainty')) {
        reasons.push('persistent_uncertainty');
    }

    if (summary.risk_signals.includes('low_practicum_connection')) {
        reasons.push('low_practicum_connection');
    }

    if (summary.risk_signals.includes('ethics_without_action')) {
        reasons.push('ethics_without_action');
    }

    return {
        needsReview: reasons.length > 0,
        reasons,
    };
}

function normalizeTurnSignal(
    raw: any,
    payload: {
        sessionId: string;
        userId: string;
        activityId?: string | null;
        turnNumber: number;
        utteranceText: string;
        activityConfig: ActivityConfig;
    },
): TurnResearchSignal {
    return {
        session_id: payload.sessionId,
        user_id: payload.userId,
        activity_id: payload.activityId || null,
        turn_number: payload.turnNumber,
        utterance_text: payload.utteranceText,
        learner_level: payload.activityConfig.learnerLevel,
        activity_goal: payload.activityConfig.activityGoal,
        topic: payload.activityConfig.topic,
        reflective_depth: {
            level: raw?.reflective_depth?.level || 'surface',
            confidence: clampConfidence(raw?.reflective_depth?.confidence),
            evidence_span: normalizeString(raw?.reflective_depth?.evidence_span),
        },
        uncertainty: {
            level: raw?.uncertainty?.level || 'low',
            types: normalizeStringArray(raw?.uncertainty?.types) as TurnResearchSignal['uncertainty']['types'],
            confidence: clampConfidence(raw?.uncertainty?.confidence),
            evidence_span: normalizeString(raw?.uncertainty?.evidence_span),
        },
        ai_stance: {
            position: raw?.ai_stance?.position || 'pragmatic',
            confidence: clampConfidence(raw?.ai_stance?.confidence),
            evidence_span: normalizeString(raw?.ai_stance?.evidence_span),
        },
        critical_evaluation: {
            present: Boolean(raw?.critical_evaluation?.present),
            moves: normalizeStringArray(raw?.critical_evaluation?.moves) as TurnResearchSignal['critical_evaluation']['moves'],
            confidence: clampConfidence(raw?.critical_evaluation?.confidence),
            evidence_span: normalizeString(raw?.critical_evaluation?.evidence_span),
        },
        practicum_linkage: {
            present: Boolean(raw?.practicum_linkage?.present),
            context: raw?.practicum_linkage?.context || null,
            confidence: clampConfidence(raw?.practicum_linkage?.confidence),
            evidence_span: normalizeString(raw?.practicum_linkage?.evidence_span),
        },
        ethical_concern: {
            present: Boolean(raw?.ethical_concern?.present),
            themes: normalizeStringArray(raw?.ethical_concern?.themes) as TurnResearchSignal['ethical_concern']['themes'],
            confidence: clampConfidence(raw?.ethical_concern?.confidence),
            evidence_span: normalizeString(raw?.ethical_concern?.evidence_span),
        },
        self_efficacy: {
            level: raw?.self_efficacy?.level || 'mixed',
            confidence: clampConfidence(raw?.self_efficacy?.confidence),
            evidence_span: normalizeString(raw?.self_efficacy?.evidence_span),
        },
        next_step_readiness: {
            level: raw?.next_step_readiness?.level || 'tentative',
            confidence: clampConfidence(raw?.next_step_readiness?.confidence),
            evidence_span: normalizeString(raw?.next_step_readiness?.evidence_span),
        },
    };
}

function normalizeSessionSummary(
    raw: any,
    payload: {
        sessionId: string;
        userId: string;
        activityId?: string | null;
        activityConfig: ActivityConfig;
    },
): SessionResearchSummary {
    return {
        session_id: payload.sessionId,
        user_id: payload.userId,
        activity_id: payload.activityId || null,
        learner_level: payload.activityConfig.learnerLevel,
        activity_goal: payload.activityConfig.activityGoal,
        topic: payload.activityConfig.topic,
        session_arc: raw?.session_arc || 'mixed_progression',
        dominant_tensions: normalizeStringArray(raw?.dominant_tensions) as SessionResearchSummary['dominant_tensions'],
        growth_signals: normalizeStringArray(raw?.growth_signals),
        risk_signals: normalizeStringArray(raw?.risk_signals) as SessionResearchSummary['risk_signals'],
        recommended_support: normalizeStringArray(raw?.recommended_support) as SessionResearchSummary['recommended_support'],
        summary_narrative: normalizeString(raw?.summary_narrative),
        overall_confidence: clampConfidence(raw?.overall_confidence),
    };
}

export async function extractAndSaveTurnResearchSignal(payload: {
    sessionId: string;
    userId: string;
    activityId?: string | null;
    turnNumber: number;
    utteranceText: string;
    recentMessages: Message[];
    activityConfig: ActivityConfig;
}): Promise<void> {
    const ai = getGeminiClient();
    if (!ai || !payload.utteranceText.trim()) {
        return;
    }

    const recentContext = payload.recentMessages
        .slice(-4)
        .map((message) => `${message.role === 'user' ? 'Learner' : 'TINA'}: ${message.text}`)
        .join('\n');

    const prompt = `
You are an educational research extraction assistant working on preservice teacher conversations.
Return only JSON that follows the provided schema.

Task:
- Read the learner utterance in context.
- Extract reflective learning signals from casual everyday language.
- Stay conservative. If the evidence is weak, lower confidence instead of over-claiming.
- evidence_span must be a short verbatim excerpt from the learner utterance when possible.

Activity context:
${buildActivityContext(payload.activityConfig)}

Recent conversation context:
${recentContext || 'No recent context available.'}

Learner utterance:
${payload.utteranceText}
`.trim();

    try {
        const response = await ai.models.generateContent({
            model: TURN_SIGNAL_MODEL,
            contents: prompt,
            config: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseJsonSchema: TURN_SIGNAL_SCHEMA,
            },
        });

        const parsed = safeParseJSON<any>(response.text || '');
        if (!parsed) {
            return;
        }

        const normalized = normalizeTurnSignal(parsed, payload);
        const reviewMeta = buildTurnReviewMeta(normalized);

        const { error } = await supabase.from('session_reflection_signals').upsert({
            session_id: normalized.session_id,
            user_id: normalized.user_id,
            activity_id: normalized.activity_id,
            turn_number: normalized.turn_number,
            utterance_text: normalized.utterance_text,
            learner_level: normalized.learner_level,
            activity_goal: normalized.activity_goal,
            topic: normalized.topic,
            reflective_depth_level: normalized.reflective_depth.level,
            reflective_depth_confidence: normalized.reflective_depth.confidence,
            reflective_depth_evidence: normalized.reflective_depth.evidence_span,
            uncertainty_level: normalized.uncertainty.level,
            uncertainty_types: normalized.uncertainty.types,
            uncertainty_confidence: normalized.uncertainty.confidence,
            uncertainty_evidence: normalized.uncertainty.evidence_span,
            ai_stance_position: normalized.ai_stance.position,
            ai_stance_confidence: normalized.ai_stance.confidence,
            ai_stance_evidence: normalized.ai_stance.evidence_span,
            critical_evaluation_present: normalized.critical_evaluation.present,
            critical_evaluation_moves: normalized.critical_evaluation.moves,
            critical_evaluation_confidence: normalized.critical_evaluation.confidence,
            critical_evaluation_evidence: normalized.critical_evaluation.evidence_span,
            practicum_linkage_present: normalized.practicum_linkage.present,
            practicum_linkage_context: normalized.practicum_linkage.context,
            practicum_linkage_confidence: normalized.practicum_linkage.confidence,
            practicum_linkage_evidence: normalized.practicum_linkage.evidence_span,
            ethical_concern_present: normalized.ethical_concern.present,
            ethical_concern_themes: normalized.ethical_concern.themes,
            ethical_concern_confidence: normalized.ethical_concern.confidence,
            ethical_concern_evidence: normalized.ethical_concern.evidence_span,
            self_efficacy_level: normalized.self_efficacy.level,
            self_efficacy_confidence: normalized.self_efficacy.confidence,
            self_efficacy_evidence: normalized.self_efficacy.evidence_span,
            next_step_readiness_level: normalized.next_step_readiness.level,
            next_step_readiness_confidence: normalized.next_step_readiness.confidence,
            next_step_readiness_evidence: normalized.next_step_readiness.evidence_span,
            model_name: TURN_SIGNAL_MODEL,
            prompt_version: TURN_SIGNAL_PROMPT_VERSION,
            extraction_status: 'completed',
            needs_review: reviewMeta.needsReview,
            review_reason: reviewMeta.reasons,
            raw_extraction: normalized,
        }, { onConflict: 'session_id,turn_number' });

        if (error) {
            console.error('Failed to save turn research signal:', error);
        }
    } catch (error) {
        console.warn('Turn research extraction failed:', error);
    }
}

export async function synthesizeAndSaveSessionResearchSummary(payload: {
    sessionId: string;
    userId: string;
    activityId?: string | null;
    activityConfig: ActivityConfig;
    messages: Message[];
}): Promise<void> {
    const ai = getGeminiClient();
    if (!ai) {
        return;
    }

    const learnerTranscript = payload.messages
        .filter((message) => message.role === 'user')
        .map((message, index) => `Turn ${index + 1}: ${message.text}`)
        .join('\n');

    if (!learnerTranscript.trim()) {
        return;
    }

    const prompt = `
You are creating a research-grade session synthesis for a preservice teacher reflection chatbot.
Return only JSON that follows the provided schema.

Goal:
- Summarize the learner's reflective trajectory across the full session.
- Focus on learning process, not grading.
- Use growth_signals and risk_signals that would help an instructor decide what support to offer next.

Activity context:
${buildActivityContext(payload.activityConfig)}

Learner transcript:
${learnerTranscript}
`.trim();

    try {
        const response = await ai.models.generateContent({
            model: SESSION_SUMMARY_MODEL,
            contents: prompt,
            config: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                responseJsonSchema: SESSION_SUMMARY_SCHEMA,
            },
        });

        const parsed = safeParseJSON<any>(response.text || '');
        if (!parsed) {
            return;
        }

        const normalized = normalizeSessionSummary(parsed, payload);
        const reviewMeta = buildSummaryReviewMeta(normalized);

        const { error } = await supabase.from('session_reflection_summaries').upsert({
            session_id: normalized.session_id,
            user_id: normalized.user_id,
            activity_id: normalized.activity_id,
            learner_level: normalized.learner_level,
            activity_goal: normalized.activity_goal,
            topic: normalized.topic,
            session_arc: normalized.session_arc,
            dominant_tensions: normalized.dominant_tensions,
            growth_signals: normalized.growth_signals,
            risk_signals: normalized.risk_signals,
            recommended_support: normalized.recommended_support,
            summary_narrative: normalized.summary_narrative,
            overall_confidence: normalized.overall_confidence,
            model_name: SESSION_SUMMARY_MODEL,
            prompt_version: SESSION_SUMMARY_PROMPT_VERSION,
            needs_review: reviewMeta.needsReview,
            review_reason: reviewMeta.reasons,
            review_status: reviewMeta.needsReview ? 'unreviewed' : 'cleared',
            raw_summary: normalized,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id' });

        if (error) {
            console.error('Failed to save session research summary:', error);
        }
    } catch (error) {
        console.warn('Session research summary failed:', error);
    }
}
