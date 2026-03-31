// Types for TINA application

export interface User {
  id: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
}

export type ActivityGoal =
  | 'reflection'
  | 'case-analysis'
  | 'lesson-design'
  | 'ethics-decision'
  | 'feedback-revision';

export type LearnerLevel =
  | 'intro-preservice'
  | 'mid-program'
  | 'practicum-ready'
  | 'graduate';

export type OutputFormat =
  | 'short-reflection'
  | 'three-point-action-plan'
  | 'lesson-idea-draft'
  | 'case-response-outline'
  | 'checklist';

export interface ActivityConfig {
  title: string;
  courseName: string;
  moduleLabel: string;
  topic: string;
  learnerDescription: string;
  activityGoal: ActivityGoal;
  learnerLevel: LearnerLevel;
  scenario?: string;
  estimatedMinutes?: number;
  guidance: {
    evidenceFirst: boolean;
    compareAlternatives: boolean;
    learnerImpact: boolean;
    ethicsPrivacy: boolean;
    revisionBeforeWrapUp: boolean;
  };
  constraints: {
    noFullSubmissionDraftFirst: boolean;
    noOneClickAnswers: boolean;
    reasoningBeforeConclusion: boolean;
    conciseResponses: boolean;
  };
  outputFormat: OutputFormat;
  instructorNote?: string;
}

export type TeacherCluster =
  | 'ethically_aware_hesitant'
  | 'motivated_limited_supported'
  | 'confident_ai_ready';

export interface ClusterScores {
  ethically_aware_hesitant: number;
  motivated_limited_supported: number;
  confident_ai_ready: number;
}

export interface Session {
  id: string;
  user_id: string;
  messages: Message[];
  summary_report: string | null;
  layer1_keywords: string[];
  layer2_keywords: string[];
  layer3_keywords: string[];
  teacher_cluster: TeacherCluster | null;
  cluster_scores: ClusterScores | null;
  turn_count: number;
  created_at: string;
  completed_at: string | null;
  // Analytics fields
  session_duration_seconds?: number;
  completion_status?: 'in_progress' | 'completed' | 'abandoned';
  pdf_downloaded?: boolean;
  voice_input_used?: boolean;
  session_resumed?: boolean;
  avg_response_length?: number;
  analytics_data?: SessionAnalyticsData;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Affect-Aware Analytics Types
export interface TurnAnalytics {
  turn_number: number;
  response_time_ms: number;
  user_message_length: number;
  sentiment_score: number;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  arousal_level: number;
  valence: number;
  engagement_score: number;
  hesitation_detected: boolean;
  confusion_detected: boolean;
  layer_detected: 'layer1' | 'layer2' | 'layer3' | null;
  keywords_detected: string[];
  values_mentioned: string[];
  concerns_mentioned: string[];
  timestamp: string;
  // Advanced NLP analysis
  emotion_label?: string;
  emotion_score?: number;
  discourse_type?: string;
  discourse_score?: number;
  self_efficacy_level?: string;
  self_efficacy_score?: number;
  belief_practice_type?: string;
  belief_practice_score?: number;
  ai_attitude?: string;
  ai_attitude_score?: number;
}

export interface SessionAnalyticsData {
  sentiment_trajectory: number[];
  avg_engagement: number;
  total_hesitations: number;
  total_confusions: number;
  all_values_mentioned: string[];
  all_concerns_mentioned: string[];
  layer_distribution: { layer1: number; layer2: number; layer3: number };
}
