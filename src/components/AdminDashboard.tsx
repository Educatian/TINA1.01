import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getActivityOutputs, getAllSessions } from '../hooks/useSession';
import { useAuth } from '../hooks/useAuth';
import { assignLearnerToActivity, defaultActivityConfig, deleteInstructorActivity, listActivityEnrollments, listInstructorActivities, removeLearnerFromActivity, saveInstructorActivity, setActiveActivityRecord, setActivityPublished } from '../services/activityConfig';
import { setRolePreview } from '../services/rolePreview';
import { ActivityConfigForm } from './ActivityConfigForm';
import type { ActivityConfig, ActivityEnrollment, ActivityRecord, Session, SessionOutput } from '../types';

interface UserProfile { id: string; email: string; role: string; created_at: string; }
interface SessionAnalyticsRecord {
  id: string; session_id: string; turn_number: number; sentiment_score: number; sentiment_label: string;
  engagement_score: number; emotion_label: string; discourse_type: string; self_efficacy_level: string; ai_attitude: string; created_at: string;
}
interface ReflectionSignalRecord {
  id: string;
  session_id: string;
  user_id: string;
  activity_id: string | null;
  turn_number: number;
  utterance_text: string;
  topic: string | null;
  reflective_depth_level: string;
  reflective_depth_confidence: number;
  reflective_depth_evidence: string;
  uncertainty_level: string;
  uncertainty_confidence: number;
  uncertainty_evidence: string;
  ai_stance_position: string;
  ai_stance_confidence: number;
  ai_stance_evidence: string;
  ethical_concern_present: boolean;
  ethical_concern_themes?: string[];
  ethical_concern_evidence?: string;
  practicum_linkage_present: boolean;
  practicum_linkage_context?: string | null;
  practicum_linkage_evidence?: string;
  next_step_readiness_level: string;
  next_step_readiness_evidence?: string;
  model_name?: string;
  prompt_version?: string;
  needs_review?: boolean;
  review_reason?: string[];
  reviewed_at?: string | null;
  created_at: string;
}
interface ReflectionSummaryRecord {
  id: string;
  session_id: string;
  user_id: string;
  activity_id: string | null;
  topic?: string | null;
  session_arc: string;
  dominant_tensions: string[];
  risk_signals: string[];
  recommended_support: string[];
  overall_confidence: number;
  summary_narrative?: string;
  needs_review?: boolean;
  review_reason?: string[];
  review_status?: string;
  review_notes?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}
interface HumanCodingRecord {
  id: string;
  session_id: string;
  turn_number: number;
  coder_id: string;
  reflective_depth_level: string;
  uncertainty_level: string;
  ai_stance_position: string;
  ethical_concern_present: boolean;
  practicum_linkage_present: boolean;
  next_step_readiness_level: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}
type DashboardTab = 'activity' | 'overview' | 'analytics' | 'research' | 'review' | 'coding' | 'users';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTab>('activity');
  const [sessionAnalytics, setSessionAnalytics] = useState<SessionAnalyticsRecord[]>([]);
  const [updatingRole, setUpdatingRole] = useState<string | null>(null);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityConfig, setActivityConfig] = useState<ActivityConfig>(defaultActivityConfig);
  const [activityStatus, setActivityStatus] = useState('');
  const [activityBusyId, setActivityBusyId] = useState<string | null>(null);
  const [enrollments, setEnrollments] = useState<ActivityEnrollment[]>([]);
  const [enrollmentBusyId, setEnrollmentBusyId] = useState<string | null>(null);
  const [activityOutputs, setActivityOutputs] = useState<SessionOutput[]>([]);
  const [liveLearnerCount, setLiveLearnerCount] = useState(0);
  const [reflectionSignals, setReflectionSignals] = useState<ReflectionSignalRecord[]>([]);
  const [reflectionSummaries, setReflectionSummaries] = useState<ReflectionSummaryRecord[]>([]);
  const [humanCodingRecords, setHumanCodingRecords] = useState<HumanCodingRecord[]>([]);
  const [selectedResearchSignalId, setSelectedResearchSignalId] = useState<string | null>(null);
  const [selectedCodingSignalId, setSelectedCodingSignalId] = useState<string | null>(null);
  const [reviewStatusMessage, setReviewStatusMessage] = useState('');
  const [codingStatusMessage, setCodingStatusMessage] = useState('');
  const [isSavingCoding, setIsSavingCoding] = useState(false);
  const [codingDraft, setCodingDraft] = useState({
    reflective_depth_level: 'emerging',
    uncertainty_level: 'medium',
    ai_stance_position: 'pragmatic',
    ethical_concern_present: false,
    practicum_linkage_present: false,
    next_step_readiness_level: 'tentative',
    notes: '',
  });

  const loadDashboardData = async () => {
    const sessionsData = await getAllSessions();
    setSessions(sessionsData);
    const results = await Promise.allSettled([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('session_analytics').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('session_reflection_signals').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('session_reflection_summaries').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('human_coded_reflection_signals').select('*').order('updated_at', { ascending: false }).limit(300),
    ]);

    const [usersResult, analyticsResult, signalsResult, summariesResult, codingResult] = results;

    if (usersResult.status === 'fulfilled') {
      if (usersResult.value.error) console.error('Failed to load users:', usersResult.value.error);
      if (usersResult.value.data) setUsers(usersResult.value.data);
    } else {
      console.error('Failed to load users:', usersResult.reason);
    }

    if (analyticsResult.status === 'fulfilled') {
      if (analyticsResult.value.error) console.error('Failed to load session analytics:', analyticsResult.value.error);
      if (analyticsResult.value.data) setSessionAnalytics(analyticsResult.value.data);
    } else {
      console.error('Failed to load session analytics:', analyticsResult.reason);
    }

    if (signalsResult.status === 'fulfilled') {
      if (signalsResult.value.error) console.error('Failed to load reflection signals:', signalsResult.value.error);
      if (signalsResult.value.data) setReflectionSignals(signalsResult.value.data as ReflectionSignalRecord[]);
    } else {
      console.error('Failed to load reflection signals:', signalsResult.reason);
    }

    if (summariesResult.status === 'fulfilled') {
      if (summariesResult.value.error) console.error('Failed to load reflection summaries:', summariesResult.value.error);
      if (summariesResult.value.data) setReflectionSummaries(summariesResult.value.data as ReflectionSummaryRecord[]);
    } else {
      console.error('Failed to load reflection summaries:', summariesResult.reason);
    }

    if (codingResult.status === 'fulfilled') {
      if (codingResult.value.error) console.error('Failed to load human coding records:', codingResult.value.error);
      if (codingResult.value.data) setHumanCodingRecords(codingResult.value.data as HumanCodingRecord[]);
    } else {
      console.error('Failed to load human coding records:', codingResult.reason);
    }
  };

  const loadActivities = async () => {
    if (!user) return;
    const records = await listInstructorActivities(user.id);
    setActivities(records);
    if (records.length === 0) {
      setSelectedActivityId(null);
      setActivityConfig(defaultActivityConfig);
      setActiveActivityRecord(null);
      return;
    }
    const nextSelected = records.find((record) => record.id === selectedActivityId) || records[0];
    setSelectedActivityId(nextSelected.id);
    setActivityConfig(nextSelected);
    setActiveActivityRecord(nextSelected);
  };

  const loadEnrollments = async (activityId: string | null) => {
    if (!activityId) {
      setEnrollments([]);
      setActivityOutputs([]);
      return;
    }
    const rows = await listActivityEnrollments(activityId);
    setEnrollments(rows);
    const outputs = await getActivityOutputs(activityId);
    setActivityOutputs(outputs);
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setDashboardError('');
      try {
        await Promise.all([loadDashboardData(), loadActivities()]);
      } catch (error) {
        console.error('Failed to initialize admin dashboard:', error);
        setDashboardError('Some dashboard data could not be loaded. You can still use the available sections while we retry.');
      } finally {
        setLoading(false);
      }
    };
    void loadData();
  }, [user]);

  useEffect(() => {
    void loadEnrollments(selectedActivityId);
  }, [selectedActivityId]);

  useEffect(() => {
    let presenceChannel: RealtimeChannel | null = null;

    if (!selectedActivityId || !user) {
      setLiveLearnerCount(0);
      return;
    }

    presenceChannel = supabase.channel(`activity-presence:${selectedActivityId}`);

    const syncPresenceCount = () => {
      const state = presenceChannel?.presenceState() || {};
      setLiveLearnerCount(Object.keys(state).length);
    };

    presenceChannel
      .on('presence', { event: 'sync' }, syncPresenceCount)
      .subscribe();

    return () => {
      if (presenceChannel) {
        void supabase.removeChannel(presenceChannel);
      }
    };
  }, [selectedActivityId, user]);

  useEffect(() => {
    if (!selectedResearchSignalId && reflectionSignals.length > 0) {
      setSelectedResearchSignalId(reflectionSignals[0].id);
    }
  }, [reflectionSignals, selectedResearchSignalId]);

  useEffect(() => {
    if (!selectedCodingSignalId && reflectionSignals.length > 0) {
      setSelectedCodingSignalId(reflectionSignals[0].id);
    }
  }, [reflectionSignals, selectedCodingSignalId]);

  useEffect(() => {
    if (existingHumanCoding) {
      setCodingDraft({
        reflective_depth_level: existingHumanCoding.reflective_depth_level,
        uncertainty_level: existingHumanCoding.uncertainty_level,
        ai_stance_position: existingHumanCoding.ai_stance_position,
        ethical_concern_present: existingHumanCoding.ethical_concern_present,
        practicum_linkage_present: existingHumanCoding.practicum_linkage_present,
        next_step_readiness_level: existingHumanCoding.next_step_readiness_level,
        notes: existingHumanCoding.notes || '',
      });
      return;
    }

    if (selectedCodingSignal) {
      setCodingDraft({
        reflective_depth_level: selectedCodingSignal.reflective_depth_level,
        uncertainty_level: selectedCodingSignal.uncertainty_level,
        ai_stance_position: selectedCodingSignal.ai_stance_position,
        ethical_concern_present: selectedCodingSignal.ethical_concern_present,
        practicum_linkage_present: selectedCodingSignal.practicum_linkage_present,
        next_step_readiness_level: selectedCodingSignal.next_step_readiness_level,
        notes: '',
      });
    }
  }, [existingHumanCoding, selectedCodingSignal]);

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    setUpdatingRole(userId);
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    if (!error) setUsers((prev) => prev.map((profile) => profile.id === userId ? { ...profile, role: newRole } : profile));
    else { console.error('Failed to update role:', error); alert('Failed to update role. Check database permissions.'); }
    setUpdatingRole(null);
  };

  const handleCreateNewActivity = () => {
    setSelectedActivityId(null);
    setActivityConfig(defaultActivityConfig);
    setActivityStatus('Creating a new activity draft. Save to add it to Supabase.');
  };

  const handleSelectActivity = (activity: ActivityRecord) => {
    setSelectedActivityId(activity.id);
    setActivityConfig(activity);
    setActiveActivityRecord(activity);
    setActivityStatus(`Selected "${activity.title}" as the active instructor activity.`);
  };

  const handleSaveActivity = async (config: ActivityConfig) => {
    if (!user) return;
    const savedRecord = await saveInstructorActivity(user.id, config, selectedActivityId);
    if (!savedRecord) return;
    const refreshedActivities = await listInstructorActivities(user.id);
    setActivities(refreshedActivities);
    setSelectedActivityId(savedRecord.id);
    setActivityConfig(savedRecord);
    setActivityStatus(`Saved "${savedRecord.title}" and set it as the active chat activity.`);
  };

  const handleTogglePublished = async (activity: ActivityRecord) => {
    setActivityBusyId(activity.id);
    try {
      const updatedActivity = await setActivityPublished(activity.id, !activity.isPublished);
      setActivities((prev) => prev.map((record) => record.id === updatedActivity.id ? updatedActivity : record));
      if (selectedActivityId === updatedActivity.id) setActivityConfig(updatedActivity);
      setActivityStatus(updatedActivity.isPublished ? `"${updatedActivity.title}" is now published for learners.` : `"${updatedActivity.title}" is now hidden from learners.`);
    } finally {
      setActivityBusyId(null);
    }
  };

  const handleDeleteActivity = async (activity: ActivityRecord) => {
    if (!window.confirm(`Delete "${activity.title}"? This cannot be undone.`)) return;
    setActivityBusyId(activity.id);
    try {
      await deleteInstructorActivity(activity.id);
      const refreshedActivities = activities.filter((record) => record.id !== activity.id);
      setActivities(refreshedActivities);
      if (selectedActivityId === activity.id) {
        const nextActivity = refreshedActivities[0] || null;
        setSelectedActivityId(nextActivity?.id || null);
        setActivityConfig(nextActivity || defaultActivityConfig);
        setActiveActivityRecord(nextActivity);
      }
      setActivityStatus(`Deleted "${activity.title}".`);
    } finally {
      setActivityBusyId(null);
    }
  };

  const handleToggleEnrollment = async (learnerId: string) => {
    if (!selectedActivityId) return;
    setEnrollmentBusyId(learnerId);
    try {
      const isAssigned = enrollments.some((enrollment) => enrollment.learnerId === learnerId);
      const learnerEmail = users.find((profile) => profile.id === learnerId)?.email || 'learner';
      if (isAssigned) {
        await removeLearnerFromActivity(selectedActivityId, learnerId);
        setActivityStatus(`Removed ${learnerEmail} from "${selectedActivity?.title || 'this activity'}".`);
      } else {
        await assignLearnerToActivity(selectedActivityId, learnerId);
        setActivityStatus(`Assigned ${learnerEmail} to "${selectedActivity?.title || 'this activity'}".`);
      }
      await loadEnrollments(selectedActivityId);
    } finally {
      setEnrollmentBusyId(null);
    }
  };

  const handlePreviewLearnerExperience = (activity: ActivityRecord) => {
    setActiveActivityRecord(activity);
    setRolePreview('learner');
    navigate('/');
    window.location.reload();
  };

  const formatSignalLabel = (value: string) => value.replaceAll('_', ' ');

  const handleMarkReviewResolved = async (source: 'signal' | 'summary', recordId: string) => {
    if (!user) return;

    const payload = {
      needs_review: false,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    };

    const table = source === 'signal' ? 'session_reflection_signals' : 'session_reflection_summaries';
    const summaryExtras = source === 'summary' ? { review_status: 'reviewed' } : {};

    const { error } = await supabase.from(table).update({
      ...payload,
      ...summaryExtras,
    }).eq('id', recordId);

    if (error) {
      console.error('Failed to resolve review item:', error);
      setReviewStatusMessage('Unable to mark this item as reviewed yet.');
      return;
    }

    if (source === 'signal') {
      setReflectionSignals((prev) => prev.map((record) => record.id === recordId ? { ...record, needs_review: false, reviewed_at: payload.reviewed_at } : record));
    } else {
      setReflectionSummaries((prev) => prev.map((record) => record.id === recordId ? { ...record, needs_review: false, review_status: 'reviewed', reviewed_at: payload.reviewed_at } : record));
    }

    setReviewStatusMessage('Review item marked as resolved.');
  };

  const handleSaveHumanCoding = async () => {
    if (!user || !selectedCodingSignal) return;

    setIsSavingCoding(true);
    setCodingStatusMessage('');

    const { error, data } = await supabase
      .from('human_coded_reflection_signals')
      .upsert({
        session_id: selectedCodingSignal.session_id,
        turn_number: selectedCodingSignal.turn_number,
        coder_id: user.id,
        reflective_depth_level: codingDraft.reflective_depth_level,
        uncertainty_level: codingDraft.uncertainty_level,
        ai_stance_position: codingDraft.ai_stance_position,
        ethical_concern_present: codingDraft.ethical_concern_present,
        practicum_linkage_present: codingDraft.practicum_linkage_present,
        next_step_readiness_level: codingDraft.next_step_readiness_level,
        notes: codingDraft.notes.trim() || null,
      }, { onConflict: 'session_id,turn_number,coder_id' })
      .select('*')
      .single();

    if (error) {
      console.error('Failed to save human coding:', error);
      setCodingStatusMessage('Unable to save human coding yet.');
      setIsSavingCoding(false);
      return;
    }

    if (data) {
      setHumanCodingRecords((prev) => {
        const others = prev.filter((record) => !(record.session_id === data.session_id && record.turn_number === data.turn_number && record.coder_id === data.coder_id));
        return [data as HumanCodingRecord, ...others];
      });
    }

    setCodingStatusMessage('Human coding saved.');
    setIsSavingCoding(false);
  };

  const filteredSessions = selectedUserId ? sessions.filter((s) => s.user_id === selectedUserId) : sessions;
  const completedSessions = filteredSessions.filter((s) => s.completed_at);
  const totalTurns = filteredSessions.reduce((sum, s) => sum + (s.turn_count || 0), 0);
  const avgTurns = filteredSessions.length > 0 ? (totalTurns / filteredSessions.length).toFixed(1) : '0.0';
  const userSessionCounts = users.map((profile) => ({ user: profile, sessionCount: sessions.filter((s) => s.user_id === profile.id).length, completedCount: sessions.filter((s) => s.user_id === profile.id && s.completed_at).length }));
  const avgSentiment = sessionAnalytics.length > 0 ? (sessionAnalytics.reduce((sum, a) => sum + (a.sentiment_score || 0), 0) / sessionAnalytics.length).toFixed(2) : '0.00';
  const avgEngagement = sessionAnalytics.length > 0 ? (sessionAnalytics.reduce((sum, a) => sum + (a.engagement_score || 0), 0) / sessionAnalytics.length).toFixed(2) : '0.00';
  const emotionCounts = sessionAnalytics.reduce((acc, record) => { if (record.emotion_label) acc[record.emotion_label] = (acc[record.emotion_label] || 0) + 1; return acc; }, {} as Record<string, number>);
  const attitudeCounts = sessionAnalytics.reduce((acc, record) => { if (record.ai_attitude) acc[record.ai_attitude] = (acc[record.ai_attitude] || 0) + 1; return acc; }, {} as Record<string, number>);
  const depthCounts = reflectionSignals.reduce((acc, record) => { if (record.reflective_depth_level) acc[record.reflective_depth_level] = (acc[record.reflective_depth_level] || 0) + 1; return acc; }, {} as Record<string, number>);
  const uncertaintyCounts = reflectionSignals.reduce((acc, record) => { if (record.uncertainty_level) acc[record.uncertainty_level] = (acc[record.uncertainty_level] || 0) + 1; return acc; }, {} as Record<string, number>);
  const stanceCounts = reflectionSignals.reduce((acc, record) => { if (record.ai_stance_position) acc[record.ai_stance_position] = (acc[record.ai_stance_position] || 0) + 1; return acc; }, {} as Record<string, number>);
  const sessionArcCounts = reflectionSummaries.reduce((acc, record) => { if (record.session_arc) acc[record.session_arc] = (acc[record.session_arc] || 0) + 1; return acc; }, {} as Record<string, number>);
  const supportCounts = reflectionSummaries.reduce((acc, record) => {
    record.recommended_support?.forEach((support) => {
      acc[support] = (acc[support] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);
  const selectedUser = users.find((profile) => profile.id === selectedUserId);
  const selectedActivity = useMemo(() => activities.find((activity) => activity.id === selectedActivityId) || null, [activities, selectedActivityId]);
  const learnerCandidates = useMemo(() => users, [users]);
  const enrolledLearnerIds = useMemo(() => new Set(enrollments.map((enrollment) => enrollment.learnerId)), [enrollments]);
  const selectedActivitySessions = useMemo(() => sessions.filter((session) => session.activity_id === selectedActivityId), [sessions, selectedActivityId]);
  const selectedActivityCompletedSessions = useMemo(() => selectedActivitySessions.filter((session) => session.completed_at), [selectedActivitySessions]);
  const startedLearnerCount = useMemo(() => new Set(selectedActivitySessions.map((session) => session.user_id)).size, [selectedActivitySessions]);
  const completedLearnerCount = useMemo(() => new Set(selectedActivityCompletedSessions.map((session) => session.user_id)).size, [selectedActivityCompletedSessions]);
  const submittedLearnerCount = useMemo(() => new Set(activityOutputs.filter((output) => output.submittedAt).map((output) => output.userId)).size, [activityOutputs]);
  const avgActivityTurns = useMemo(() => selectedActivitySessions.length > 0 ? (selectedActivitySessions.reduce((sum, session) => sum + (session.turn_count || 0), 0) / selectedActivitySessions.length).toFixed(1) : '0.0', [selectedActivitySessions]);
  const notStartedLearnerCount = useMemo(() => Math.max(enrollments.length - startedLearnerCount, 0), [enrollments.length, startedLearnerCount]);
  const followUpLearnerCount = useMemo(() => new Set(selectedActivitySessions.filter((session) => !session.completed_at || (session.turn_count || 0) < 4).map((session) => session.user_id)).size, [selectedActivitySessions]);
  const lifecycleSteps = useMemo(() => {
    if (!selectedActivity) return [];
    return [
      { label: 'Drafted', done: true },
      { label: 'Published', done: selectedActivity.isPublished },
      { label: 'Assigned', done: enrollments.length > 0 },
      { label: 'Started', done: startedLearnerCount > 0 },
      { label: 'Completed', done: completedLearnerCount > 0 || submittedLearnerCount > 0 },
    ];
  }, [selectedActivity, enrollments.length, startedLearnerCount, completedLearnerCount, submittedLearnerCount]);
  const workflowNextStep = useMemo(() => {
    if (!selectedActivity) return 'Create or select an activity to begin.';
    if (!selectedActivity.isPublished) return 'Publish this activity so learners can access it.';
    if (enrollments.length === 0) return 'Assign at least one learner to this activity.';
    if (startedLearnerCount === 0) return 'Invite learners to begin so you can monitor progress.';
    if (submittedLearnerCount === 0) return 'Review live progress and wait for the first submitted reflection.';
    return 'Review recent outputs and decide who may need follow-up.';
  }, [selectedActivity, enrollments.length, startedLearnerCount, submittedLearnerCount]);
  const workflowStatusLabel = selectedActivity
    ? lifecycleSteps.find((step) => !step.done)?.label || 'Review'
    : 'Start';
  const avgResearchConfidence = reflectionSummaries.length > 0
    ? (reflectionSummaries.reduce((sum, record) => sum + (record.overall_confidence || 0), 0) / reflectionSummaries.length).toFixed(2)
    : '0.00';
  const researchCoverage = new Set(reflectionSignals.map((record) => record.session_id)).size;
  const ethicalConcernRate = reflectionSignals.length > 0
    ? Math.round((reflectionSignals.filter((record) => record.ethical_concern_present).length / reflectionSignals.length) * 100)
    : 0;
  const practicumLinkRate = reflectionSignals.length > 0
    ? Math.round((reflectionSignals.filter((record) => record.practicum_linkage_present).length / reflectionSignals.length) * 100)
    : 0;
  const adminBriefCards = [
    { label: 'Activities', value: activities.length, tone: 'neutral' },
    { label: 'Learners', value: users.filter((profile) => profile.role !== 'admin').length, tone: 'neutral' },
    { label: 'Submitted Outputs', value: activityOutputs.length, tone: 'neutral' },
    { label: 'Live Now', value: liveLearnerCount, tone: liveLearnerCount > 0 ? 'positive' : 'neutral' },
  ];
  const reviewQueue = useMemo(() => ([
    ...reflectionSignals
      .filter((record) => record.needs_review)
      .map((record) => ({
        id: `signal:${record.id}`,
        source: 'signal' as const,
        sourceId: record.id,
        sessionId: record.session_id,
        title: `Turn ${record.turn_number} needs review`,
        subtitle: record.review_reason?.map(formatSignalLabel).join(', ') || 'signal review',
        confidence: Math.min(
          record.reflective_depth_confidence || 1,
          record.uncertainty_confidence || 1,
          record.ai_stance_confidence || 1,
        ),
        createdAt: record.created_at,
      })),
    ...reflectionSummaries
      .filter((record) => record.needs_review)
      .map((record) => ({
        id: `summary:${record.id}`,
        source: 'summary' as const,
        sourceId: record.id,
        sessionId: record.session_id,
        title: formatSignalLabel(record.session_arc),
        subtitle: record.review_reason?.map(formatSignalLabel).join(', ') || 'summary review',
        confidence: record.overall_confidence || 0,
        createdAt: record.created_at,
      })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())), [reflectionSignals, reflectionSummaries]);
  const selectedResearchSignal = useMemo(
    () => reflectionSignals.find((record) => record.id === selectedResearchSignalId) || reflectionSignals[0] || null,
    [reflectionSignals, selectedResearchSignalId],
  );
  const selectedResearchSession = useMemo(
    () => sessions.find((session) => session.id === selectedResearchSignal?.session_id) || null,
    [sessions, selectedResearchSignal],
  );
  const selectedResearchSummary = useMemo(
    () => reflectionSummaries.find((record) => record.session_id === selectedResearchSignal?.session_id) || null,
    [reflectionSummaries, selectedResearchSignal],
  );
  const selectedCodingSignal = useMemo(
    () => reflectionSignals.find((record) => record.id === selectedCodingSignalId) || reflectionSignals[0] || null,
    [reflectionSignals, selectedCodingSignalId],
  );
  const existingHumanCoding = useMemo(
    () => humanCodingRecords.find((record) => record.session_id === selectedCodingSignal?.session_id && record.turn_number === selectedCodingSignal?.turn_number && record.coder_id === user?.id) || null,
    [humanCodingRecords, selectedCodingSignal, user],
  );
  const reviewedSignalCount = reflectionSignals.filter((record) => !record.needs_review).length;
  const reviewedSummaryCount = reflectionSummaries.filter((record) => !record.needs_review).length;
  const codingCoverageCount = new Set(humanCodingRecords.map((record) => `${record.session_id}:${record.turn_number}`)).size;

  if (loading) return <div className="admin-container"><p>Loading analytics...</p></div>;

  const tabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'activity', label: 'Activity Studio' },
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'NLP Analytics' },
    { id: 'research', label: 'Research Signals' },
    { id: 'review', label: 'Review Queue' },
    { id: 'coding', label: 'Human Coding' },
    { id: 'users', label: 'User Management' },
  ];

  return (
    <div className="admin-container">
      <div className="admin-brief">
        <div>
          <p className="admin-brief-kicker">Admin workspace</p>
          <h1 className="admin-brief-title">TINA Dashboard</h1>
          <p className="admin-brief-copy">Compact monitoring for activities, learner progress, and research signals without forcing long page scans.</p>
        </div>
        <div className="admin-brief-grid">
          {adminBriefCards.map((card) => (
            <div key={card.label} className={`admin-brief-card admin-brief-card-${card.tone}`}>
              <span className="admin-brief-label">{card.label}</span>
              <strong className="admin-brief-value">{card.value}</strong>
            </div>
          ))}
        </div>
      </div>

      {dashboardError && <p className="dashboard-status-message">{dashboardError}</p>}

      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-tab ${activeTab === tab.id ? 'admin-tab-active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'activity' && (
        <div>
          <div className="admin-header">
            <h1>Activity Studio</h1>
            <p className="admin-header-copy">Build one shared activity, publish it, assign learners, and monitor what needs attention next.</p>
          </div>
          <div className="activity-studio-layout">
            <div className="activity-studio-sidebar">
              <div className="activity-studio-next-step">
                <p className="activity-studio-next-step-label">
                  Next step: {workflowStatusLabel}
                </p>
                <p className="activity-studio-next-step-copy">{workflowNextStep}</p>
              </div>
              <div className="activity-studio-sidebar-header">
                <h3>Activities ({activities.length})</h3>
                <button className="btn btn-secondary activity-studio-compact-button" onClick={handleCreateNewActivity}>New Activity</button>
              </div>
              <div className="activity-studio-list">
                {activities.map((activity) => (
                  <div key={activity.id} className={`activity-studio-item ${selectedActivityId === activity.id ? 'activity-studio-item-active' : ''}`}>
                    <button onClick={() => handleSelectActivity(activity)} className="activity-studio-select">
                      <div className="activity-studio-item-top">
                        <strong className="activity-studio-item-title">{activity.title}</strong>
                        <span className={`activity-studio-status ${activity.isPublished ? 'activity-studio-status-published' : 'activity-studio-status-draft'}`}>{activity.isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <p className="activity-studio-item-meta">{activity.courseName} / {activity.moduleLabel}</p>
                    </button>
                    <div className="activity-studio-item-actions">
                      <button className="btn btn-secondary activity-studio-mini-button" onClick={() => handleTogglePublished(activity)} disabled={activityBusyId === activity.id}>
                        {activityBusyId === activity.id ? 'Working...' : activity.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="btn btn-secondary activity-studio-mini-button" onClick={() => handleDeleteActivity(activity)} disabled={activityBusyId === activity.id}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {selectedActivity && <div className="activity-studio-context-note">This selected activity is also your current instructor chat context.</div>}
              {selectedActivity && (
                <div className="activity-studio-sidebar-stack">
                  <button
                    className="btn btn-primary activity-studio-preview-button"
                    onClick={() => handlePreviewLearnerExperience(selectedActivity)}
                  >
                    Preview Learner Experience
                  </button>
                  <div className="activity-studio-lifecycle">
                    <strong className="activity-studio-lifecycle-title">Activity Lifecycle</strong>
                    <div className="activity-studio-lifecycle-list">
                      {lifecycleSteps.map((step) => (
                        <span
                          key={step.label}
                          className={`activity-studio-lifecycle-chip ${step.done ? 'activity-studio-lifecycle-chip-done' : 'activity-studio-lifecycle-chip-next'}`}
                        >
                          {step.done ? 'Done' : 'Next'}: {step.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {activityStatus && <p className="activity-studio-status-message">{activityStatus}</p>}
            </div>
            <div className="activity-studio-main">
              <ActivityConfigForm initialConfig={activityConfig} onSave={handleSaveActivity} saveLabel={selectedActivityId ? 'Update Activity' : 'Create Activity'} />
              <div className="activity-form-section">
                <h3>Assign Learners</h3>
                <p>Choose who should receive this activity. Admin accounts can also be assigned here for learner-mode testing in the same app.</p>
                {!selectedActivityId && <p className="activity-support-copy">Save or select an activity before managing enrollments.</p>}
                {selectedActivityId && (
                  <div className="activity-enrollment-list admin-scroll-panel">
                    {learnerCandidates.map((learner) => {
                      const isAssigned = enrolledLearnerIds.has(learner.id);
                      return (
                        <div key={learner.id} className="activity-enrollment-item">
                          <div>
                            <strong className="activity-enrollment-email">{learner.email}</strong>
                            <p className="activity-enrollment-copy">{isAssigned ? 'Assigned to this activity' : 'Not assigned yet'}</p>
                          </div>
                          <button className="btn btn-secondary activity-enrollment-button" onClick={() => handleToggleEnrollment(learner.id)} disabled={enrollmentBusyId === learner.id}>
                            {enrollmentBusyId === learner.id ? 'Saving...' : isAssigned ? 'Remove' : 'Assign'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedActivityId && (
                <div className="activity-form-section">
                  <h3>Monitor Activity</h3>
                  <div className="stats-grid activity-stats-grid">
                    <div className="stat-card">
                      <h3>Assigned</h3>
                      <div className="value">{enrollments.length}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Started</h3>
                      <div className="value">{startedLearnerCount}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Completed</h3>
                      <div className="value">{completedLearnerCount}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Submitted</h3>
                      <div className="value">{submittedLearnerCount}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Avg Turns</h3>
                      <div className="value">{avgActivityTurns}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Live Now</h3>
                      <div className="value">{liveLearnerCount}</div>
                    </div>
                  </div>

                  <h3 className="activity-section-heading">What Needs Attention</h3>
                  <div className="stats-grid activity-stats-grid">
                    <div className="stat-card">
                      <h3>Not Started</h3>
                      <div className="value">{notStartedLearnerCount}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Need Follow-Up</h3>
                      <div className="value">{followUpLearnerCount}</div>
                    </div>
                    <div className="stat-card">
                      <h3>Ready To Review</h3>
                      <div className="value">{submittedLearnerCount}</div>
                    </div>
                  </div>

                  {(notStartedLearnerCount > 0 || followUpLearnerCount > 0) && (
                    <div className="activity-warning-card">
                      <strong className="activity-warning-title">What needs attention next</strong>
                      {notStartedLearnerCount > 0 && (
                        <p className="activity-warning-copy">{notStartedLearnerCount} assigned learner(s) have not started this activity yet.</p>
                      )}
                      {followUpLearnerCount > 0 && (
                        <p className="activity-warning-copy">{followUpLearnerCount} learner(s) may need follow-up because they have short or unfinished sessions.</p>
                      )}
                    </div>
                  )}

                  <h3 className="activity-section-heading">Recent Outputs</h3>
                  {activityOutputs.length === 0 ? (
                    <p className="activity-support-copy">No submitted outputs yet for this activity.</p>
                  ) : (
                    <div className="sessions-table activity-table-spaced dashboard-table-shell">
                      <table>
                        <thead>
                          <tr>
                            <th>Learner</th>
                            <th>Format</th>
                            <th>Submitted</th>
                            <th>Preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activityOutputs.slice(0, 10).map((output) => {
                            const outputUser = users.find((profile) => profile.id === output.userId);
                            return (
                              <tr key={output.id}>
                                <td>{outputUser?.email || 'Unknown'}</td>
                                <td>{output.outputFormat}</td>
                                <td>{output.submittedAt ? new Date(output.submittedAt).toLocaleDateString() : '-'}</td>
                                <td className="activity-output-preview">
                                  {output.outputText.slice(0, 120)}{output.outputText.length > 120 ? '...' : ''}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="dashboard-split-layout">
          <div className="dashboard-side-panel">
            <h3 className="dashboard-side-title">Users ({users.length})</h3>
            <button onClick={() => setSelectedUserId(null)} className={`dashboard-user-button ${selectedUserId === null ? 'dashboard-user-button-active' : ''}`}>
              All Users
              <span className="dashboard-user-count">{sessions.length} sessions</span>
            </button>
            <div className="dashboard-user-list">
              {userSessionCounts.map(({ user: profile, sessionCount, completedCount }) => (
                <button key={profile.id} onClick={() => setSelectedUserId(profile.id)} className={`dashboard-user-button ${selectedUserId === profile.id ? 'dashboard-user-button-active' : ''}`}>
                  <div className="dashboard-user-topline">
                    {profile.email}
                    {profile.role === 'admin' && <span className="dashboard-admin-tag">ADMIN</span>}
                  </div>
                  <div className="dashboard-user-subline">{sessionCount} sessions / {completedCount} completed</div>
                </button>
              ))}
            </div>
          </div>
          <div className="dashboard-main-panel">
            <div className="admin-header">
              <h1>TINA Overview</h1>
              <p className="admin-header-copy">{selectedUser ? `Viewing: ${selectedUser.email}` : 'All users overview'}</p>
            </div>
            <div className="stats-grid stats-grid-compact">
              <div className="stat-card stat-card-compact"><h3>Sessions</h3><div className="value">{filteredSessions.length}</div></div>
              <div className="stat-card stat-card-compact"><h3>Completed</h3><div className="value">{completedSessions.length}</div></div>
              <div className="stat-card stat-card-compact"><h3>Avg. Turns</h3><div className="value">{avgTurns}</div></div>
              <div className="stat-card stat-card-compact"><h3>Completion Rate</h3><div className="value">{filteredSessions.length > 0 ? Math.round((completedSessions.length / filteredSessions.length) * 100) : 0}%</div></div>
            </div>
            <h2 className="dashboard-section-title">Recent Sessions</h2>
            <div className="sessions-table dashboard-table-shell">
              <table><thead><tr><th>User</th><th>Date</th><th>Turns</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {filteredSessions.slice(0, 20).map((session) => {
                  const sessionUser = users.find((profile) => profile.id === session.user_id);
                  return <tr key={session.id}><td className="table-cell-muted">{sessionUser?.email || 'Unknown'}</td><td>{new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td>{session.turn_count || 0}</td><td><span className={`status-badge ${session.completed_at ? 'status-completed' : 'status-pending'}`}>{session.completed_at ? 'Completed' : 'In Progress'}</span></td><td>{session.completed_at && <button className="btn btn-secondary table-action-button" onClick={() => navigate(`/certificate/${session.id}`)}>View</button>}</td></tr>;
                })}
              </tbody></table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="admin-page-shell">
          <div className="admin-header admin-header-tight">
            <h1 className="dashboard-page-title">NLP Analytics</h1>
            <p className="dashboard-page-copy">Legacy session analytics from <code>session_analytics</code>, summarized in compact panels.</p>
          </div>
          <div className="stats-grid stats-grid-compact">
            <div className="stat-card stat-card-compact"><h3>Total Records</h3><div className="value">{sessionAnalytics.length}</div></div>
            <div className="stat-card stat-card-compact"><h3>Avg Sentiment</h3><div className={`value ${parseFloat(avgSentiment) > 0.5 ? 'metric-positive' : 'metric-danger'}`}>{avgSentiment}</div></div>
            <div className="stat-card stat-card-compact"><h3>Avg Engagement</h3><div className="value metric-info">{avgEngagement}</div></div>
            <div className="stat-card stat-card-compact"><h3>Sessions Analyzed</h3><div className="value">{new Set(sessionAnalytics.map((a) => a.session_id)).size}</div></div>
          </div>
          <div className="analytics-grid analytics-grid-compact">
            <div className="analytics-panel">
              <h3 className="analytics-panel-title">Emotion Distribution</h3>
              {Object.entries(emotionCounts).slice(0, 6).map(([emotion, count]) => <div key={emotion} className="analytics-row"><span className="analytics-row-label">{emotion}</span><progress className={`analytics-progress analytics-progress-${getEmotionTone(emotion)}`} max={sessionAnalytics.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
            </div>
            <div className="analytics-panel">
              <h3 className="analytics-panel-title">AI Attitude Distribution</h3>
              {Object.entries(attitudeCounts).slice(0, 4).map(([attitude, count]) => <div key={attitude} className="analytics-row"><span className="analytics-row-label">{attitude}</span><progress className={`analytics-progress analytics-progress-${getAttitudeTone(attitude)}`} max={sessionAnalytics.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
            </div>
          </div>
          <h3 className="dashboard-section-title">Raw Analytics Data (Last 50)</h3>
          <div className="sessions-table dashboard-table-shell">
            <table><thead><tr><th>Turn</th><th>Sentiment</th><th>Engagement</th><th>Emotion</th><th>AI Attitude</th><th>Efficacy</th><th>Date</th></tr></thead><tbody>
              {sessionAnalytics.slice(0, 50).map((record) => <tr key={record.id}><td>{record.turn_number}</td><td className={record.sentiment_score > 0.5 ? 'metric-positive-cell' : 'metric-danger-cell'}>{record.sentiment_score?.toFixed(2) || '-'}</td><td>{record.engagement_score?.toFixed(2) || '-'}</td><td>{record.emotion_label || '-'}</td><td>{record.ai_attitude || '-'}</td><td>{record.self_efficacy_level || '-'}</td><td>{new Date(record.created_at).toLocaleDateString()}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      {activeTab === 'research' && (
        <div className="admin-page-shell">
          <div className="admin-header admin-header-tight">
            <h1 className="dashboard-page-title">Research Signals</h1>
            <p className="dashboard-page-copy">Gemini-structured reflection signals and session synthesis for preservice teacher learning analytics.</p>
          </div>
          <div className="stats-grid stats-grid-compact">
            <div className="stat-card stat-card-compact"><h3>Turn Signals</h3><div className="value">{reflectionSignals.length}</div></div>
            <div className="stat-card stat-card-compact"><h3>Session Summaries</h3><div className="value">{reflectionSummaries.length}</div></div>
            <div className="stat-card stat-card-compact"><h3>Coverage</h3><div className="value">{researchCoverage}</div></div>
            <div className="stat-card stat-card-compact"><h3>Avg Confidence</h3><div className="value">{avgResearchConfidence}</div></div>
            <div className="stat-card stat-card-compact"><h3>Ethics Mention</h3><div className="value">{ethicalConcernRate}%</div></div>
            <div className="stat-card stat-card-compact"><h3>Practicum Link</h3><div className="value">{practicumLinkRate}%</div></div>
          </div>
          <div className="analytics-grid analytics-grid-compact">
            <div className="analytics-panel">
              <h3 className="analytics-panel-title">Turn-Level Signals</h3>
              {Object.entries(depthCounts).slice(0, 3).map(([depth, count]) => <div key={depth} className="analytics-row"><span className="analytics-row-label">{depth}</span><progress className="analytics-progress analytics-progress-info" max={reflectionSignals.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
              {Object.entries(uncertaintyCounts).slice(0, 3).map(([level, count]) => <div key={level} className="analytics-row"><span className="analytics-row-label">{level} uncertainty</span><progress className="analytics-progress analytics-progress-warning" max={reflectionSignals.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
              {Object.entries(stanceCounts).slice(0, 4).map(([stance, count]) => <div key={stance} className="analytics-row"><span className="analytics-row-label">{stance}</span><progress className="analytics-progress analytics-progress-positive" max={reflectionSignals.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
            </div>
            <div className="analytics-panel">
              <h3 className="analytics-panel-title">Session Trajectory</h3>
              {Object.entries(sessionArcCounts).slice(0, 4).map(([arc, count]) => <div key={arc} className="analytics-row"><span className="analytics-row-label">{arc.replaceAll('_', ' ')}</span><progress className="analytics-progress analytics-progress-info" max={reflectionSummaries.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
              {Object.entries(supportCounts).slice(0, 5).map(([support, count]) => <div key={support} className="analytics-row"><span className="analytics-row-label">{support.replaceAll('_', ' ')}</span><progress className="analytics-progress analytics-progress-warning" max={reflectionSummaries.length || 1} value={count} /><span className="analytics-row-value">{count}</span></div>)}
            </div>
          </div>
          <div className="dashboard-panel-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Recent Turn Signals</h3>
                <span className="dashboard-panel-meta">Last 12 learner turns</span>
              </div>
              <div className="sessions-table dashboard-table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Turn</th>
                      <th>Depth</th>
                      <th>Uncertainty</th>
                      <th>AI Stance</th>
                      <th>Ready</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reflectionSignals.slice(0, 12).map((record) => (
                      <tr
                        key={record.id}
                        className={selectedResearchSignal?.id === record.id ? 'dashboard-row-active' : ''}
                        onClick={() => setSelectedResearchSignalId(record.id)}
                      >
                        <td>{record.turn_number}</td>
                        <td>{record.reflective_depth_level}</td>
                        <td>{record.uncertainty_level}</td>
                        <td>{record.ai_stance_position}</td>
                        <td>{record.next_step_readiness_level}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Recent Session Synthesis</h3>
                <span className="dashboard-panel-meta">Latest trajectories</span>
              </div>
              <div className="dashboard-signal-list admin-scroll-panel">
                {reflectionSummaries.slice(0, 8).map((record) => (
                  <article key={record.id} className="dashboard-signal-card">
                    <div className="dashboard-signal-topline">
                      <strong>{record.session_arc.replaceAll('_', ' ')}</strong>
                      <span className="dashboard-signal-confidence">confidence {record.overall_confidence?.toFixed(2) || '0.00'}</span>
                    </div>
                    <p className="dashboard-signal-copy">
                      Support: {record.recommended_support?.slice(0, 2).map((item) => item.replaceAll('_', ' ')).join(', ') || 'none recorded'}
                    </p>
                    <p className="dashboard-signal-copy">
                      Risks: {record.risk_signals?.slice(0, 2).map((item) => item.replaceAll('_', ' ')).join(', ') || 'none recorded'}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
          {selectedResearchSignal && (
            <div className="dashboard-panel-grid">
              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <h3 className="dashboard-panel-title">Signal Detail</h3>
                  <span className="dashboard-panel-meta">Turn {selectedResearchSignal.turn_number}</span>
                </div>
                <p className="dashboard-detail-quote">{selectedResearchSignal.utterance_text}</p>
                <div className="dashboard-detail-grid">
                  <div className="dashboard-detail-card">
                    <strong>Reflective depth</strong>
                    <p>{selectedResearchSignal.reflective_depth_level} · confidence {selectedResearchSignal.reflective_depth_confidence?.toFixed(2) || '0.00'}</p>
                    <span>{selectedResearchSignal.reflective_depth_evidence || 'No evidence span captured.'}</span>
                  </div>
                  <div className="dashboard-detail-card">
                    <strong>Uncertainty</strong>
                    <p>{selectedResearchSignal.uncertainty_level} · confidence {selectedResearchSignal.uncertainty_confidence?.toFixed(2) || '0.00'}</p>
                    <span>{selectedResearchSignal.uncertainty_evidence || 'No evidence span captured.'}</span>
                  </div>
                  <div className="dashboard-detail-card">
                    <strong>AI stance</strong>
                    <p>{selectedResearchSignal.ai_stance_position} · confidence {selectedResearchSignal.ai_stance_confidence?.toFixed(2) || '0.00'}</p>
                    <span>{selectedResearchSignal.ai_stance_evidence || 'No evidence span captured.'}</span>
                  </div>
                  <div className="dashboard-detail-card">
                    <strong>Practicum linkage</strong>
                    <p>{selectedResearchSignal.practicum_linkage_present ? (selectedResearchSignal.practicum_linkage_context || 'linked') : 'not detected'}</p>
                    <span>{selectedResearchSignal.practicum_linkage_evidence || 'No evidence span captured.'}</span>
                  </div>
                </div>
              </section>
              <section className="dashboard-panel">
                <div className="dashboard-panel-header">
                  <h3 className="dashboard-panel-title">Session Context</h3>
                  <span className="dashboard-panel-meta">{selectedResearchSummary?.session_arc ? formatSignalLabel(selectedResearchSummary.session_arc) : 'No session synthesis yet'}</span>
                </div>
                <p className="dashboard-signal-copy">{selectedResearchSummary?.summary_narrative || 'Run a full session to capture session-level synthesis.'}</p>
                <div className="dashboard-chip-row">
                  {(selectedResearchSummary?.dominant_tensions || []).slice(0, 4).map((tension) => (
                    <span key={tension} className="dashboard-chip">{formatSignalLabel(tension)}</span>
                  ))}
                </div>
                <div className="dashboard-transcript">
                  {(selectedResearchSession?.messages || []).slice(-6).map((message, index) => (
                    <div key={`${message.timestamp || index}-${message.role}`} className={`dashboard-transcript-line dashboard-transcript-line-${message.role}`}>
                      <strong>{message.role === 'user' ? 'Learner' : 'TINA'}</strong>
                      <span>{message.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>
      )}

      {activeTab === 'review' && (
        <div className="admin-page-shell">
          <div className="admin-header admin-header-tight">
            <h1 className="dashboard-page-title">Review Queue</h1>
            <p className="dashboard-page-copy">Focus on low-confidence or pedagogically important cases before using the signals in research interpretation.</p>
          </div>
          <div className="stats-grid stats-grid-compact">
            <div className="stat-card stat-card-compact"><h3>Queue Size</h3><div className="value">{reviewQueue.length}</div></div>
            <div className="stat-card stat-card-compact"><h3>Reviewed Signals</h3><div className="value">{reviewedSignalCount}</div></div>
            <div className="stat-card stat-card-compact"><h3>Reviewed Summaries</h3><div className="value">{reviewedSummaryCount}</div></div>
          </div>
          {reviewStatusMessage && <p className="dashboard-status-message">{reviewStatusMessage}</p>}
          <div className="dashboard-panel-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Items Needing Review</h3>
                <span className="dashboard-panel-meta">{reviewQueue.length} open</span>
              </div>
              <div className="dashboard-signal-list admin-scroll-panel">
                {reviewQueue.length === 0 && <p className="activity-support-copy">No review items are waiting right now.</p>}
                {reviewQueue.map((item) => (
                  <article key={item.id} className="dashboard-signal-card">
                    <div className="dashboard-signal-topline">
                      <strong>{item.title}</strong>
                      <span className="dashboard-signal-confidence">confidence {item.confidence.toFixed(2)}</span>
                    </div>
                    <p className="dashboard-signal-copy">{item.subtitle}</p>
                    <button className="btn btn-secondary table-action-button" onClick={() => handleMarkReviewResolved(item.source, item.sourceId)}>
                      Mark Reviewed
                    </button>
                  </article>
                ))}
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Review Guidelines</h3>
                <span className="dashboard-panel-meta">Human oversight</span>
              </div>
              <div className="dashboard-guideline-list">
                <div className="dashboard-guideline-card">
                  <strong>Low confidence</strong>
                  <p>Check whether the evidence span is actually sufficient for the inferred label.</p>
                </div>
                <div className="dashboard-guideline-card">
                  <strong>Missing practicum link</strong>
                  <p>Decide whether the learner is reflecting abstractly or whether the model missed contextual linkage.</p>
                </div>
                <div className="dashboard-guideline-card">
                  <strong>Ethics without action</strong>
                  <p>Review whether the learner raises a meaningful ethical issue but does not yet convert it into an actionable next step.</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'coding' && (
        <div className="admin-page-shell">
          <div className="admin-header admin-header-tight">
            <h1 className="dashboard-page-title">Human Coding</h1>
            <p className="dashboard-page-copy">Capture instructor or researcher labels so you can compare AI-extracted signals with human interpretation.</p>
          </div>
          <div className="stats-grid stats-grid-compact">
            <div className="stat-card stat-card-compact"><h3>Coded Turns</h3><div className="value">{codingCoverageCount}</div></div>
            <div className="stat-card stat-card-compact"><h3>Your Coding</h3><div className="value">{humanCodingRecords.filter((record) => record.coder_id === user?.id).length}</div></div>
          </div>
          {codingStatusMessage && <p className="dashboard-status-message">{codingStatusMessage}</p>}
          <div className="dashboard-panel-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Choose A Turn</h3>
                <span className="dashboard-panel-meta">Latest 20 signals</span>
              </div>
              <div className="dashboard-signal-list admin-scroll-panel">
                {reflectionSignals.slice(0, 20).map((record) => (
                  <article
                    key={record.id}
                    className={`dashboard-signal-card ${selectedCodingSignal?.id === record.id ? 'dashboard-signal-card-active' : ''}`}
                    onClick={() => setSelectedCodingSignalId(record.id)}
                  >
                    <div className="dashboard-signal-topline">
                      <strong>Turn {record.turn_number}</strong>
                      <span className="dashboard-signal-confidence">{record.reflective_depth_level}</span>
                    </div>
                    <p className="dashboard-signal-copy">{record.utterance_text.slice(0, 140)}{record.utterance_text.length > 140 ? '...' : ''}</p>
                  </article>
                ))}
              </div>
            </section>
            <section className="dashboard-panel">
              <div className="dashboard-panel-header">
                <h3 className="dashboard-panel-title">Coding Form</h3>
                <span className="dashboard-panel-meta">{existingHumanCoding ? 'Existing coding loaded' : 'Seeded from AI signal'}</span>
              </div>
              {selectedCodingSignal ? (
                <div className="dashboard-coding-form">
                  <p className="dashboard-detail-quote">{selectedCodingSignal.utterance_text}</p>
                  <label className="dashboard-field">
                    <span>Reflective depth</span>
                    <select value={codingDraft.reflective_depth_level} onChange={(event) => setCodingDraft((prev) => ({ ...prev, reflective_depth_level: event.target.value }))}>
                      <option value="surface">surface</option>
                      <option value="emerging">emerging</option>
                      <option value="developed">developed</option>
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Uncertainty</span>
                    <select value={codingDraft.uncertainty_level} onChange={(event) => setCodingDraft((prev) => ({ ...prev, uncertainty_level: event.target.value }))}>
                      <option value="low">low</option>
                      <option value="medium">medium</option>
                      <option value="high">high</option>
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>AI stance</span>
                    <select value={codingDraft.ai_stance_position} onChange={(event) => setCodingDraft((prev) => ({ ...prev, ai_stance_position: event.target.value }))}>
                      <option value="avoidant">avoidant</option>
                      <option value="cautious">cautious</option>
                      <option value="pragmatic">pragmatic</option>
                      <option value="enthusiastic">enthusiastic</option>
                      <option value="dependent">dependent</option>
                    </select>
                  </label>
                  <label className="dashboard-field">
                    <span>Next-step readiness</span>
                    <select value={codingDraft.next_step_readiness_level} onChange={(event) => setCodingDraft((prev) => ({ ...prev, next_step_readiness_level: event.target.value }))}>
                      <option value="not_ready">not ready</option>
                      <option value="tentative">tentative</option>
                      <option value="actionable">actionable</option>
                    </select>
                  </label>
                  <label className="dashboard-checkbox">
                    <input type="checkbox" checked={codingDraft.ethical_concern_present} onChange={(event) => setCodingDraft((prev) => ({ ...prev, ethical_concern_present: event.target.checked }))} />
                    <span>Ethical concern present</span>
                  </label>
                  <label className="dashboard-checkbox">
                    <input type="checkbox" checked={codingDraft.practicum_linkage_present} onChange={(event) => setCodingDraft((prev) => ({ ...prev, practicum_linkage_present: event.target.checked }))} />
                    <span>Practicum linkage present</span>
                  </label>
                  <label className="dashboard-field">
                    <span>Coding notes</span>
                    <textarea
                      value={codingDraft.notes}
                      onChange={(event) => setCodingDraft((prev) => ({ ...prev, notes: event.target.value }))}
                      rows={4}
                      placeholder="Add brief reasoning for your coding decision."
                    />
                  </label>
                  <button className="btn btn-primary" onClick={handleSaveHumanCoding} disabled={isSavingCoding}>
                    {isSavingCoding ? 'Saving...' : 'Save Human Coding'}
                  </button>
                </div>
              ) : (
                <p className="activity-support-copy">No turn signals are available yet for coding.</p>
              )}
            </section>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-page-shell">
          <h1 className="dashboard-page-title">User Management</h1>
          <p className="dashboard-page-copy">Toggle admin status for users. Admins can access the dashboard and update shared activity settings.</p>
          <div className="sessions-table dashboard-table-shell">
            <table><thead><tr><th>Email</th><th>Role</th><th>Sessions</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
              {users.map((dashboardUser) => {
                const sessionCount = sessions.filter((s) => s.user_id === dashboardUser.id).length;
                return <tr key={dashboardUser.id}><td>{dashboardUser.email}</td><td><span className={`dashboard-role-pill ${dashboardUser.role === 'admin' ? 'dashboard-role-pill-admin' : 'dashboard-role-pill-user'}`}>{dashboardUser.role?.toUpperCase() || 'USER'}</span></td><td>{sessionCount}</td><td>{new Date(dashboardUser.created_at).toLocaleDateString()}</td><td><button onClick={() => toggleAdminRole(dashboardUser.id, dashboardUser.role)} disabled={updatingRole === dashboardUser.id} className={`dashboard-role-button ${dashboardUser.role === 'admin' ? 'dashboard-role-button-demote' : 'dashboard-role-button-promote'}`}>{updatingRole === dashboardUser.id ? 'Updating...' : dashboardUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</button></td></tr>;
              })}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
