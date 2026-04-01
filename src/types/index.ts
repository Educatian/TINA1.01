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

export interface ActivityRecord extends ActivityConfig {
  id: string;
  instructorId: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEnrollment {
  id: string;
  activityId: string;
  learnerId: string;
  status: 'assigned' | 'started' | 'completed';
  createdAt: string;
}

export interface SessionOutput {
  id: string;
  sessionId: string;
  activityId: string;
  userId: string;
  outputFormat: OutputFormat;
  outputText: string;
  submittedAt: string | null;
  createdAt: string;
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
  activity_id?: string | null;
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

export type ReflectiveDepthLevel = 'surface' | 'emerging' | 'developed';
export type UncertaintyLevel = 'low' | 'medium' | 'high';
export type UncertaintyType = 'knowledge' | 'pedagogical' | 'ethical' | 'practicum';
export type AIStancePosition = 'avoidant' | 'cautious' | 'pragmatic' | 'enthusiastic' | 'dependent';
export type CriticalEvaluationMove =
  | 'questioning_output'
  | 'checking_bias'
  | 'seeking_evidence'
  | 'comparing_alternatives';
export type PracticumContext =
  | 'lesson planning'
  | 'classroom management'
  | 'assessment'
  | 'feedback'
  | 'ethics'
  | 'general';
export type EthicalConcernTheme =
  | 'fairness'
  | 'bias'
  | 'privacy'
  | 'transparency'
  | 'student_dependency';
export type SelfEfficacyLevel = 'low' | 'mixed' | 'high';
export type NextStepReadinessLevel = 'not_ready' | 'tentative' | 'actionable';

export interface ResearchDimension<T extends string> {
  level?: T;
  position?: T;
  present?: boolean;
  context?: string | null;
  types?: string[];
  moves?: string[];
  themes?: string[];
  confidence: number;
  evidence_span: string;
}

export interface TurnResearchSignal {
  session_id: string;
  user_id: string;
  activity_id?: string | null;
  turn_number: number;
  utterance_text: string;
  learner_level?: LearnerLevel;
  activity_goal?: ActivityGoal;
  topic?: string;
  reflective_depth: ResearchDimension<ReflectiveDepthLevel>;
  uncertainty: ResearchDimension<UncertaintyLevel> & { types: UncertaintyType[] };
  ai_stance: ResearchDimension<AIStancePosition> & { position: AIStancePosition };
  critical_evaluation: ResearchDimension<'present'> & {
    present: boolean;
    moves: CriticalEvaluationMove[];
  };
  practicum_linkage: ResearchDimension<'present'> & {
    present: boolean;
    context: PracticumContext | null;
  };
  ethical_concern: ResearchDimension<'present'> & {
    present: boolean;
    themes: EthicalConcernTheme[];
  };
  self_efficacy: ResearchDimension<SelfEfficacyLevel>;
  next_step_readiness: ResearchDimension<NextStepReadinessLevel>;
  created_at?: string;
}

export type SessionArc =
  | 'stuck_to_exploratory'
  | 'exploratory_to_actionable'
  | 'consistently_reflective'
  | 'mixed_progression';

export type DominantTension =
  | 'efficiency_vs_authenticity'
  | 'innovation_vs_ethics'
  | 'confidence_vs_control'
  | 'support_vs_dependency'
  | 'access_vs_equity';

export type RiskSignal =
  | 'high_dependency_on_ai'
  | 'low_critical_checking'
  | 'low_practicum_connection'
  | 'persistent_uncertainty'
  | 'ethics_without_action';

export type RecommendedSupport =
  | 'prompt_for_counterexample'
  | 'ask_for_classroom_evidence'
  | 'invite_policy_reflection'
  | 'encourage_small_practicum_experiment'
  | 'surface_equity_tradeoffs';

export interface SessionResearchSummary {
  session_id: string;
  user_id: string;
  activity_id?: string | null;
  learner_level?: LearnerLevel;
  activity_goal?: ActivityGoal;
  topic?: string;
  session_arc: SessionArc;
  dominant_tensions: DominantTension[];
  growth_signals: string[];
  risk_signals: RiskSignal[];
  recommended_support: RecommendedSupport[];
  summary_narrative: string;
  overall_confidence: number;
  created_at?: string;
  updated_at?: string;
}
