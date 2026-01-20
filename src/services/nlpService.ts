import { HfInference } from '@huggingface/inference';

// Initialize HuggingFace client
const hf = new HfInference(import.meta.env.VITE_HUGGINGFACE_API_KEY);

export interface SentimentResult {
    label: string;
    score: number;
}

export interface SessionAnalytics {
    sessionId: string;
    overallSentiment: number;
    sentimentByTurn: SentimentResult[];
    dominantEmotion: string;
}

// Analyze sentiment of a single text
export async function analyzeSentiment(text: string): Promise<SentimentResult[]> {
    try {
        const result = await hf.textClassification({
            model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
            inputs: text.slice(0, 500), // Limit text length
        });
        return result as SentimentResult[];
    } catch (error) {
        console.error('Sentiment analysis error:', error);
        return [{ label: 'neutral', score: 0.5 }];
    }
}

// Convert sentiment label to numeric score
function sentimentToScore(results: SentimentResult[]): number {
    const top = results[0];
    if (!top) return 0.5;

    switch (top.label.toLowerCase()) {
        case 'positive':
            return 0.5 + (top.score * 0.5);
        case 'negative':
            return 0.5 - (top.score * 0.5);
        default:
            return 0.5;
    }
}

// Analyze all messages in a session
export async function analyzeSession(messages: { role: string; text: string }[]): Promise<SessionAnalytics> {
    const userMessages = messages.filter(m => m.role === 'user');

    const sentimentResults: SentimentResult[] = [];
    const scores: number[] = [];

    // Analyze each user message (limit to prevent API overuse)
    const messagesToAnalyze = userMessages.slice(0, 10);

    for (const msg of messagesToAnalyze) {
        const result = await analyzeSentiment(msg.text);
        sentimentResults.push(result[0] || { label: 'neutral', score: 0.5 });
        scores.push(sentimentToScore(result));
    }

    const overallSentiment = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0.5;

    // Determine dominant emotion
    const labelCounts: Record<string, number> = {};
    sentimentResults.forEach(r => {
        labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
    });
    const dominantEmotion = Object.entries(labelCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

    return {
        sessionId: '',
        overallSentiment,
        sentimentByTurn: sentimentResults,
        dominantEmotion,
    };
}

// Batch analyze multiple sessions
export async function analyzeMultipleSessions(
    sessions: { id: string; messages: { role: string; text: string }[] }[]
): Promise<SessionAnalytics[]> {
    const results: SessionAnalytics[] = [];

    for (const session of sessions) {
        const analysis = await analyzeSession(session.messages);
        results.push({ ...analysis, sessionId: session.id });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    return results;
}

// ============================================
// Teacher Cluster Classification
// ============================================

import type { TeacherCluster, ClusterScores } from '../types';

// Cluster labels for zero-shot classification
const CLUSTER_LABELS = [
    'ethically concerned but hesitant to act on AI integration',
    'motivated to use AI but lacking resources and institutional support',
    'confident and well-prepared with AI tools and resources'
];

// Map classification results to our cluster types
const LABEL_TO_CLUSTER: Record<string, TeacherCluster> = {
    'ethically concerned but hesitant to act on AI integration': 'ethically_aware_hesitant',
    'motivated to use AI but lacking resources and institutional support': 'motivated_limited_supported',
    'confident and well-prepared with AI tools and resources': 'confident_ai_ready'
};

export interface ClusterResult {
    cluster: TeacherCluster;
    scores: ClusterScores;
    confidence: number;
}

// Classify teacher into one of three clusters based on conversation
export async function classifyTeacherCluster(
    messages: { role: string; text: string }[]
): Promise<ClusterResult> {
    try {
        // Combine all user messages
        const userText = messages
            .filter(m => m.role === 'user')
            .map(m => m.text)
            .join(' ')
            .slice(0, 1000); // Limit for API

        if (!userText.trim()) {
            return getDefaultResult();
        }

        const result = await hf.zeroShotClassification({
            model: 'facebook/bart-large-mnli',
            inputs: userText,
            parameters: {
                candidate_labels: CLUSTER_LABELS,
                multi_label: false
            }
        });

        // Parse results
        const scores: ClusterScores = {
            ethically_aware_hesitant: 0,
            motivated_limited_supported: 0,
            confident_ai_ready: 0
        };

        let topLabel = CLUSTER_LABELS[0];
        let topScore = 0;

        if (result && result.labels && result.scores) {
            result.labels.forEach((label: string, idx: number) => {
                const clusterKey = LABEL_TO_CLUSTER[label];
                const score = result.scores[idx] || 0;

                if (clusterKey) {
                    scores[clusterKey] = Math.round(score * 100) / 100;
                }

                if (score > topScore) {
                    topScore = score;
                    topLabel = label;
                }
            });
        }

        const cluster = LABEL_TO_CLUSTER[topLabel] || 'motivated_limited_supported';

        return {
            cluster,
            scores,
            confidence: Math.round(topScore * 100) / 100
        };

    } catch (error) {
        console.error('Teacher cluster classification error:', error);
        return getDefaultResult();
    }
}

function getDefaultResult(): ClusterResult {
    return {
        cluster: 'motivated_limited_supported',
        scores: {
            ethically_aware_hesitant: 0.33,
            motivated_limited_supported: 0.34,
            confident_ai_ready: 0.33
        },
        confidence: 0.34
    };
}

// ============================================
// Advanced NLP Analysis Functions
// ============================================

export interface AdvancedAnalysisResult {
    label: string;
    score: number;
}

// 1. Emotion Analysis (6 emotions)
export async function analyzeEmotion(text: string): Promise<AdvancedAnalysisResult> {
    try {
        const result = await hf.textClassification({
            model: 'j-hartmann/emotion-english-distilroberta-base',
            inputs: text.slice(0, 500),
        });
        const top = (result as any[])[0];
        return { label: top?.label || 'neutral', score: top?.score || 0.5 };
    } catch (error) {
        console.error('Emotion analysis error:', error);
        return { label: 'neutral', score: 0.5 };
    }
}

// 2. Educational Discourse Type Analysis
const DISCOURSE_LABELS = [
    'reflecting on teaching practice',
    'expressing concern or anxiety',
    'sharing personal experience',
    'asking for guidance or advice',
    'making a commitment to change',
    'expressing uncertainty or doubt'
];

const DISCOURSE_MAP: Record<string, string> = {
    'reflecting on teaching practice': 'reflection',
    'expressing concern or anxiety': 'concern',
    'sharing personal experience': 'experience',
    'asking for guidance or advice': 'guidance',
    'making a commitment to change': 'commitment',
    'expressing uncertainty or doubt': 'uncertainty'
};

export async function analyzeDiscourse(text: string): Promise<AdvancedAnalysisResult> {
    try {
        const result = await hf.zeroShotClassification({
            model: 'facebook/bart-large-mnli',
            inputs: text.slice(0, 500),
            parameters: { candidate_labels: DISCOURSE_LABELS }
        });
        const topLabel = result.labels?.[0] || DISCOURSE_LABELS[0];
        const topScore = result.scores?.[0] || 0.5;
        return { label: DISCOURSE_MAP[topLabel] || 'reflection', score: topScore };
    } catch (error) {
        console.error('Discourse analysis error:', error);
        return { label: 'reflection', score: 0.5 };
    }
}

// 3. Self-Efficacy Analysis
const EFFICACY_LABELS = [
    'high confidence in own teaching ability',
    'low confidence or doubts about ability',
    'neutral descriptive statement'
];

const EFFICACY_MAP: Record<string, string> = {
    'high confidence in own teaching ability': 'high',
    'low confidence or doubts about ability': 'low',
    'neutral descriptive statement': 'neutral'
};

export async function analyzeSelfEfficacy(text: string): Promise<AdvancedAnalysisResult> {
    try {
        const result = await hf.zeroShotClassification({
            model: 'facebook/bart-large-mnli',
            inputs: text.slice(0, 500),
            parameters: { candidate_labels: EFFICACY_LABELS }
        });
        const topLabel = result.labels?.[0] || EFFICACY_LABELS[2];
        const topScore = result.scores?.[0] || 0.5;
        return { label: EFFICACY_MAP[topLabel] || 'neutral', score: topScore };
    } catch (error) {
        console.error('Self-efficacy analysis error:', error);
        return { label: 'neutral', score: 0.5 };
    }
}

// 4. Belief vs Practice Gap Analysis
const BELIEF_PRACTICE_LABELS = [
    'stating a belief about what should be done',
    'describing actual practice or behavior',
    'recognizing a gap between belief and practice'
];

const BELIEF_PRACTICE_MAP: Record<string, string> = {
    'stating a belief about what should be done': 'belief',
    'describing actual practice or behavior': 'practice',
    'recognizing a gap between belief and practice': 'gap_awareness'
};

export async function analyzeBeliefPractice(text: string): Promise<AdvancedAnalysisResult> {
    try {
        const result = await hf.zeroShotClassification({
            model: 'facebook/bart-large-mnli',
            inputs: text.slice(0, 500),
            parameters: { candidate_labels: BELIEF_PRACTICE_LABELS }
        });
        const topLabel = result.labels?.[0] || BELIEF_PRACTICE_LABELS[0];
        const topScore = result.scores?.[0] || 0.5;
        return { label: BELIEF_PRACTICE_MAP[topLabel] || 'belief', score: topScore };
    } catch (error) {
        console.error('Belief-practice analysis error:', error);
        return { label: 'belief', score: 0.5 };
    }
}

// 5. AI Attitude Analysis
const AI_ATTITUDE_LABELS = [
    'AI enthusiast who embraces AI tools',
    'AI skeptic who questions AI value',
    'AI pragmatist with balanced view',
    'AI anxious who worries about AI impact'
];

const AI_ATTITUDE_MAP: Record<string, string> = {
    'AI enthusiast who embraces AI tools': 'enthusiast',
    'AI skeptic who questions AI value': 'skeptic',
    'AI pragmatist with balanced view': 'pragmatist',
    'AI anxious who worries about AI impact': 'anxious'
};

export async function analyzeAIAttitude(text: string): Promise<AdvancedAnalysisResult> {
    try {
        const result = await hf.zeroShotClassification({
            model: 'facebook/bart-large-mnli',
            inputs: text.slice(0, 500),
            parameters: { candidate_labels: AI_ATTITUDE_LABELS }
        });
        const topLabel = result.labels?.[0] || AI_ATTITUDE_LABELS[2];
        const topScore = result.scores?.[0] || 0.5;
        return { label: AI_ATTITUDE_MAP[topLabel] || 'pragmatist', score: topScore };
    } catch (error) {
        console.error('AI attitude analysis error:', error);
        return { label: 'pragmatist', score: 0.5 };
    }
}

// Combined advanced analysis
export async function runAdvancedAnalysis(text: string): Promise<{
    emotion: AdvancedAnalysisResult;
    discourse: AdvancedAnalysisResult;
    selfEfficacy: AdvancedAnalysisResult;
    beliefPractice: AdvancedAnalysisResult;
    aiAttitude: AdvancedAnalysisResult;
}> {
    const [emotion, discourse, selfEfficacy, beliefPractice, aiAttitude] = await Promise.all([
        analyzeEmotion(text),
        analyzeDiscourse(text),
        analyzeSelfEfficacy(text),
        analyzeBeliefPractice(text),
        analyzeAIAttitude(text)
    ]);

    return { emotion, discourse, selfEfficacy, beliefPractice, aiAttitude };
}
