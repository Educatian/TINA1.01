import { supabase } from '../lib/supabase';
import { analyzeSentiment, runAdvancedAnalysis } from './nlpService';
import type { TurnAnalytics, SessionAnalyticsData } from '../types';

// Keywords for affect detection
const VALUE_KEYWORDS = ['equity', 'care', 'autonomy', 'connection', 'achievement', 'rigor', 'inquiry', 'student-centered', 'fairness'];
const CONCERN_KEYWORDS = ['worry', 'concern', 'afraid', 'hesitant', 'unsure', 'uncertain', 'anxious', 'nervous', 'difficult'];
const HESITATION_PATTERNS = ['i think', 'maybe', 'not sure', 'i guess', 'probably', 'kind of', 'sort of'];
const CONFUSION_PATTERNS = ['confused', 'don\'t understand', 'what do you mean', 'unclear', 'lost', 'not following'];

// Layer detection keywords
const LAYER1_KEYWORDS = ['identity', 'values', 'role', 'teacher', 'believe', 'philosophy', 'who i am'];
const LAYER2_KEYWORDS = ['ai', 'chatgpt', 'tool', 'use', 'practice', 'workflow', 'generate', 'lesson'];
const LAYER3_KEYWORDS = ['society', 'ethics', 'policy', 'equity', 'access', 'bias', 'fairness', 'transparency'];

// Session timing tracker
let sessionStartTime: number | null = null;
let turnStartTime: number | null = null;
let turnAnalyticsLog: TurnAnalytics[] = [];
let voiceInputUsed = false;

// Initialize session tracking
export function initSessionTracking(): void {
    sessionStartTime = Date.now();
    turnAnalyticsLog = [];
    voiceInputUsed = false;
}

// Mark that voice input was used
export function markVoiceInputUsed(): void {
    voiceInputUsed = true;
}

// Start tracking a new turn
export function startTurnTracking(): void {
    turnStartTime = Date.now();
}

// Analyze a user message and create turn analytics
export async function analyzeUserTurn(
    turnNumber: number,
    userMessage: string
): Promise<TurnAnalytics> {
    const responseTimeMs = turnStartTime ? Date.now() - turnStartTime : 0;
    const messageLower = userMessage.toLowerCase();

    // Sentiment analysis
    let sentimentScore = 0.5;
    let sentimentLabel: 'positive' | 'negative' | 'neutral' = 'neutral';

    try {
        const sentimentResult = await analyzeSentiment(userMessage);
        if (sentimentResult.length > 0) {
            const top = sentimentResult[0];
            sentimentLabel = top.label.toLowerCase() as 'positive' | 'negative' | 'neutral';
            sentimentScore = sentimentLabel === 'positive' ? 0.5 + top.score * 0.5 :
                sentimentLabel === 'negative' ? 0.5 - top.score * 0.5 : 0.5;
        }
    } catch (e) {
        console.warn('Sentiment analysis failed:', e);
    }

    // Detect values mentioned
    const valuesMentioned = VALUE_KEYWORDS.filter(kw => messageLower.includes(kw));

    // Detect concerns mentioned
    const concernsMentioned = CONCERN_KEYWORDS.filter(kw => messageLower.includes(kw));

    // Detect hesitation
    const hesitationDetected = HESITATION_PATTERNS.some(p => messageLower.includes(p));

    // Detect confusion
    const confusionDetected = CONFUSION_PATTERNS.some(p => messageLower.includes(p));

    // Calculate engagement (based on message length and response time)
    const avgExpectedLength = 100;
    const avgExpectedTime = 30000; // 30 seconds
    const lengthFactor = Math.min(userMessage.length / avgExpectedLength, 2) / 2;
    const timeFactor = Math.min(responseTimeMs / avgExpectedTime, 2) / 2;
    const engagementScore = Math.round((lengthFactor * 0.6 + timeFactor * 0.4) * 100) / 100;

    // Calculate arousal (from sentiment intensity and engagement)
    const arousalLevel = Math.round(Math.abs(sentimentScore - 0.5) * 2 * 100) / 100;

    // Calculate valence (from sentiment)
    const valence = Math.round((sentimentScore - 0.5) * 2 * 100) / 100;

    // Detect layer
    let layerDetected: 'layer1' | 'layer2' | 'layer3' | null = null;
    const layer1Count = LAYER1_KEYWORDS.filter(kw => messageLower.includes(kw)).length;
    const layer2Count = LAYER2_KEYWORDS.filter(kw => messageLower.includes(kw)).length;
    const layer3Count = LAYER3_KEYWORDS.filter(kw => messageLower.includes(kw)).length;

    if (layer1Count >= layer2Count && layer1Count >= layer3Count && layer1Count > 0) {
        layerDetected = 'layer1';
    } else if (layer2Count >= layer3Count && layer2Count > 0) {
        layerDetected = 'layer2';
    } else if (layer3Count > 0) {
        layerDetected = 'layer3';
    }

    // Extract keywords (simple word extraction)
    const words = userMessage.split(/\s+/).filter(w => w.length > 4);
    const keywordsDetected = [...new Set(words.slice(0, 10))];

    // Run advanced NLP analysis
    let advancedAnalysis = {
        emotion: { label: 'neutral', score: 0.5 },
        discourse: { label: 'reflection', score: 0.5 },
        selfEfficacy: { label: 'neutral', score: 0.5 },
        beliefPractice: { label: 'belief', score: 0.5 },
        aiAttitude: { label: 'pragmatist', score: 0.5 }
    };

    try {
        advancedAnalysis = await runAdvancedAnalysis(userMessage);
        console.log('Advanced analysis:', advancedAnalysis);
    } catch (e) {
        console.warn('Advanced analysis failed:', e);
    }

    const turnAnalytics: TurnAnalytics = {
        turn_number: turnNumber,
        response_time_ms: responseTimeMs,
        user_message_length: userMessage.length,
        sentiment_score: sentimentScore,
        sentiment_label: sentimentLabel,
        arousal_level: arousalLevel,
        valence: valence,
        engagement_score: engagementScore,
        hesitation_detected: hesitationDetected,
        confusion_detected: confusionDetected,
        layer_detected: layerDetected,
        keywords_detected: keywordsDetected,
        values_mentioned: valuesMentioned,
        concerns_mentioned: concernsMentioned,
        timestamp: new Date().toISOString(),
        // Advanced analysis
        emotion_label: advancedAnalysis.emotion.label,
        emotion_score: advancedAnalysis.emotion.score,
        discourse_type: advancedAnalysis.discourse.label,
        discourse_score: advancedAnalysis.discourse.score,
        self_efficacy_level: advancedAnalysis.selfEfficacy.label,
        self_efficacy_score: advancedAnalysis.selfEfficacy.score,
        belief_practice_type: advancedAnalysis.beliefPractice.label,
        belief_practice_score: advancedAnalysis.beliefPractice.score,
        ai_attitude: advancedAnalysis.aiAttitude.label,
        ai_attitude_score: advancedAnalysis.aiAttitude.score
    };

    turnAnalyticsLog.push(turnAnalytics);

    return turnAnalytics;
}

// Save turn analytics to Supabase
export async function saveTurnAnalytics(
    sessionId: string,
    turnAnalytics: TurnAnalytics
): Promise<void> {
    try {
        await supabase.from('session_analytics').insert({
            session_id: sessionId,
            turn_number: turnAnalytics.turn_number,
            response_time_ms: turnAnalytics.response_time_ms,
            user_message_length: turnAnalytics.user_message_length,
            sentiment_score: turnAnalytics.sentiment_score,
            sentiment_label: turnAnalytics.sentiment_label,
            arousal_level: turnAnalytics.arousal_level,
            valence: turnAnalytics.valence,
            engagement_score: turnAnalytics.engagement_score,
            hesitation_detected: turnAnalytics.hesitation_detected,
            confusion_detected: turnAnalytics.confusion_detected,
            layer_detected: turnAnalytics.layer_detected,
            keywords_detected: turnAnalytics.keywords_detected,
            values_mentioned: turnAnalytics.values_mentioned,
            concerns_mentioned: turnAnalytics.concerns_mentioned,
            // Advanced analysis fields
            emotion_label: turnAnalytics.emotion_label,
            emotion_score: turnAnalytics.emotion_score,
            discourse_type: turnAnalytics.discourse_type,
            discourse_score: turnAnalytics.discourse_score,
            self_efficacy_level: turnAnalytics.self_efficacy_level,
            self_efficacy_score: turnAnalytics.self_efficacy_score,
            belief_practice_type: turnAnalytics.belief_practice_type,
            belief_practice_score: turnAnalytics.belief_practice_score,
            ai_attitude: turnAnalytics.ai_attitude,
            ai_attitude_score: turnAnalytics.ai_attitude_score
        });
    } catch (e) {
        console.error('Failed to save turn analytics:', e);
    }
}

// Calculate session summary analytics
export function calculateSessionAnalytics(): SessionAnalyticsData {
    const sentimentTrajectory = turnAnalyticsLog.map(t => t.sentiment_score);
    const avgEngagement = turnAnalyticsLog.length > 0
        ? turnAnalyticsLog.reduce((sum, t) => sum + t.engagement_score, 0) / turnAnalyticsLog.length
        : 0;
    const totalHesitations = turnAnalyticsLog.filter(t => t.hesitation_detected).length;
    const totalConfusions = turnAnalyticsLog.filter(t => t.confusion_detected).length;

    const allValuesMentioned = [...new Set(turnAnalyticsLog.flatMap(t => t.values_mentioned))];
    const allConcernsMentioned = [...new Set(turnAnalyticsLog.flatMap(t => t.concerns_mentioned))];

    const layerDistribution = {
        layer1: turnAnalyticsLog.filter(t => t.layer_detected === 'layer1').length,
        layer2: turnAnalyticsLog.filter(t => t.layer_detected === 'layer2').length,
        layer3: turnAnalyticsLog.filter(t => t.layer_detected === 'layer3').length
    };

    return {
        sentiment_trajectory: sentimentTrajectory,
        avg_engagement: Math.round(avgEngagement * 100) / 100,
        total_hesitations: totalHesitations,
        total_confusions: totalConfusions,
        all_values_mentioned: allValuesMentioned,
        all_concerns_mentioned: allConcernsMentioned,
        layer_distribution: layerDistribution
    };
}

// Get session duration in seconds
export function getSessionDuration(): number {
    if (!sessionStartTime) return 0;
    return Math.round((Date.now() - sessionStartTime) / 1000);
}

// Get average response length
export function getAvgResponseLength(): number {
    if (turnAnalyticsLog.length === 0) return 0;
    return Math.round(
        turnAnalyticsLog.reduce((sum, t) => sum + t.user_message_length, 0) / turnAnalyticsLog.length
    );
}

// Check if voice input was used
export function wasVoiceInputUsed(): boolean {
    return voiceInputUsed;
}

// Save complete session analytics to sessions table
export async function saveSessionAnalytics(
    sessionId: string,
    completionStatus: 'completed' | 'abandoned' = 'completed'
): Promise<void> {
    const analytics = calculateSessionAnalytics();

    try {
        await supabase.from('sessions').update({
            session_duration_seconds: getSessionDuration(),
            completion_status: completionStatus,
            avg_response_length: getAvgResponseLength(),
            voice_input_used: voiceInputUsed,
            analytics_data: analytics
        }).eq('id', sessionId);

        console.log('Session analytics saved:', analytics);
    } catch (e) {
        console.error('Failed to save session analytics:', e);
    }
}

// Mark PDF downloaded
export async function markPDFDownloaded(sessionId: string): Promise<void> {
    try {
        await supabase.from('sessions').update({
            pdf_downloaded: true
        }).eq('id', sessionId);
    } catch (e) {
        console.error('Failed to mark PDF downloaded:', e);
    }
}
