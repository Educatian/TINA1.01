import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getActivityOutputs, getAllSessions } from '../hooks/useSession';
import { useAuth } from '../hooks/useAuth';
import { assignLearnerToActivity, defaultActivityConfig, deleteInstructorActivity, listActivityEnrollments, listInstructorActivities, removeLearnerFromActivity, saveInstructorActivity, setActiveActivityRecord, setActivityPublished } from '../services/activityConfig';
import { ActivityConfigForm } from './ActivityConfigForm';
import type { ActivityConfig, ActivityEnrollment, ActivityRecord, Session, SessionOutput } from '../types';

interface UserProfile { id: string; email: string; role: string; created_at: string; }
interface SessionAnalyticsRecord {
  id: string; session_id: string; turn_number: number; sentiment_score: number; sentiment_label: string;
  engagement_score: number; emotion_label: string; discourse_type: string; self_efficacy_level: string; ai_attitude: string; created_at: string;
}
type DashboardTab = 'activity' | 'overview' | 'analytics' | 'users';

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
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

  const loadDashboardData = async () => {
    const sessionsData = await getAllSessions();
    setSessions(sessionsData);
    const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (usersData) setUsers(usersData);
    const { data: analyticsData } = await supabase.from('session_analytics').select('*').order('created_at', { ascending: false }).limit(500);
    if (analyticsData) setSessionAnalytics(analyticsData);
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
      await Promise.all([loadDashboardData(), loadActivities()]);
      setLoading(false);
    };
    void loadData();
  }, [user]);

  useEffect(() => {
    void loadEnrollments(selectedActivityId);
  }, [selectedActivityId]);

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

  const filteredSessions = selectedUserId ? sessions.filter((s) => s.user_id === selectedUserId) : sessions;
  const completedSessions = filteredSessions.filter((s) => s.completed_at);
  const totalTurns = filteredSessions.reduce((sum, s) => sum + (s.turn_count || 0), 0);
  const avgTurns = filteredSessions.length > 0 ? (totalTurns / filteredSessions.length).toFixed(1) : '0.0';
  const userSessionCounts = users.map((profile) => ({ user: profile, sessionCount: sessions.filter((s) => s.user_id === profile.id).length, completedCount: sessions.filter((s) => s.user_id === profile.id && s.completed_at).length }));
  const avgSentiment = sessionAnalytics.length > 0 ? (sessionAnalytics.reduce((sum, a) => sum + (a.sentiment_score || 0), 0) / sessionAnalytics.length).toFixed(2) : '0.00';
  const avgEngagement = sessionAnalytics.length > 0 ? (sessionAnalytics.reduce((sum, a) => sum + (a.engagement_score || 0), 0) / sessionAnalytics.length).toFixed(2) : '0.00';
  const emotionCounts = sessionAnalytics.reduce((acc, record) => { if (record.emotion_label) acc[record.emotion_label] = (acc[record.emotion_label] || 0) + 1; return acc; }, {} as Record<string, number>);
  const attitudeCounts = sessionAnalytics.reduce((acc, record) => { if (record.ai_attitude) acc[record.ai_attitude] = (acc[record.ai_attitude] || 0) + 1; return acc; }, {} as Record<string, number>);
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

  if (loading) return <div className="admin-container"><p>Loading analytics...</p></div>;

  const tabs: Array<{ id: DashboardTab; label: string }> = [
    { id: 'activity', label: 'Shared Activity Setup' },
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'NLP Analytics' },
    { id: 'users', label: 'User Management' },
  ];

  return (
    <div className="admin-container">
      <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #E5E7EB', flexWrap: 'wrap' }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '12px 24px', border: 'none', background: activeTab === tab.id ? '#F4D03F' : 'transparent', color: activeTab === tab.id ? '#2C3E50' : '#6b7280', fontWeight: activeTab === tab.id ? '600' : 'normal', cursor: 'pointer', borderBottom: activeTab === tab.id ? '3px solid #D4AC0D' : '3px solid transparent', fontSize: '0.95rem' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'activity' && (
        <div>
          <div className="admin-header">
            <h1>Shared Activity Customization</h1>
            <p style={{ color: '#6b7280', marginTop: '8px' }}>Create activities in Supabase, choose which one is active for your instructor chat, and publish learner-facing versions when they are ready.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '24px', alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: '16px', border: '2px solid #E5E7EB', boxShadow: '4px 4px 0px rgba(0,0,0,0.05)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ color: '#52796F' }}>Activities ({activities.length})</h3>
                <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.8rem' }} onClick={handleCreateNewActivity}>New Activity</button>
              </div>
              <div style={{ display: 'grid', gap: '10px' }}>
                {activities.map((activity) => (
                  <div key={activity.id} style={{ border: selectedActivityId === activity.id ? '2px solid #84A98C' : '2px solid #E5E7EB', borderRadius: '12px', padding: '14px', background: selectedActivityId === activity.id ? '#F8FFF8' : '#fff' }}>
                    <button onClick={() => handleSelectActivity(activity)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <strong style={{ color: '#2C3E50' }}>{activity.title}</strong>
                        <span style={{ background: activity.isPublished ? '#D1FAE5' : '#FEF3C7', color: activity.isPublished ? '#059669' : '#D97706', padding: '3px 8px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{activity.isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <p style={{ color: '#6b7280', fontSize: '0.82rem', marginBottom: '8px' }}>{activity.courseName} · {activity.moduleLabel}</p>
                    </button>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleTogglePublished(activity)} disabled={activityBusyId === activity.id}>
                        {activityBusyId === activity.id ? 'Working...' : activity.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.75rem' }} onClick={() => handleDeleteActivity(activity)} disabled={activityBusyId === activity.id}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              {selectedActivity && <div style={{ marginTop: '16px', padding: '12px', background: '#FCF3CF', borderRadius: '10px', color: '#7F8C8D', fontSize: '0.85rem' }}>The selected activity is currently the active instructor chat context.</div>}
              {activityStatus && <p style={{ marginTop: '14px', color: '#2C7A7B', fontSize: '0.88rem' }}>{activityStatus}</p>}
            </div>
            <div style={{ display: 'grid', gap: '20px' }}>
              <ActivityConfigForm initialConfig={activityConfig} onSave={handleSaveActivity} saveLabel={selectedActivityId ? 'Update Activity' : 'Create Activity'} />
              <div className="activity-form-section">
                <h3>Learner Assignment</h3>
                <p>Assign the selected activity to learners. Admin accounts can also be assigned here for learner-mode testing in the same app.</p>
                {!selectedActivityId && <p style={{ marginTop: '10px', color: '#6b7280' }}>Save or select an activity before managing enrollments.</p>}
                {selectedActivityId && (
                  <div style={{ display: 'grid', gap: '10px', marginTop: '16px' }}>
                    {learnerCandidates.map((learner) => {
                      const isAssigned = enrolledLearnerIds.has(learner.id);
                      return (
                        <div key={learner.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 14px', background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                          <div>
                            <strong style={{ color: '#2C3E50' }}>{learner.email}</strong>
                            <p style={{ color: '#6b7280', fontSize: '0.82rem' }}>{isAssigned ? 'Assigned to this activity' : 'Not assigned yet'}</p>
                          </div>
                          <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.8rem' }} onClick={() => handleToggleEnrollment(learner.id)} disabled={enrollmentBusyId === learner.id}>
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
                  <h3>Activity Progress</h3>
                  <div className="stats-grid" style={{ marginTop: '16px', marginBottom: '20px' }}>
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
                  </div>

                  <h3 style={{ marginTop: '8px' }}>Recent Outputs</h3>
                  {activityOutputs.length === 0 ? (
                    <p style={{ marginTop: '12px', color: '#6b7280' }}>No submitted outputs yet for this activity.</p>
                  ) : (
                    <div className="sessions-table" style={{ marginTop: '12px' }}>
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
                                <td style={{ maxWidth: '280px', fontSize: '0.82rem', color: '#6b7280' }}>
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
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ width: '280px', flexShrink: 0, background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '4px 4px 0px rgba(0,0,0,0.05)', border: '2px solid #E5E7EB', height: 'fit-content' }}>
            <h3 style={{ marginBottom: '16px', color: '#52796F', fontSize: '1rem' }}>Users ({users.length})</h3>
            <button onClick={() => setSelectedUserId(null)} style={{ width: '100%', padding: '12px', marginBottom: '8px', border: selectedUserId === null ? '2px solid #84A98C' : '2px solid #E5E7EB', borderRadius: '8px', background: selectedUserId === null ? '#CAD2C5' : '#fff', cursor: 'pointer', textAlign: 'left', fontWeight: selectedUserId === null ? '600' : 'normal' }}>
              All Users
              <span style={{ float: 'right', fontSize: '0.85rem', color: '#6b7280' }}>{sessions.length} sessions</span>
            </button>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {userSessionCounts.map(({ user: profile, sessionCount, completedCount }) => (
                <button key={profile.id} onClick={() => setSelectedUserId(profile.id)} style={{ width: '100%', padding: '12px', marginBottom: '4px', border: selectedUserId === profile.id ? '2px solid #84A98C' : '2px solid #E5E7EB', borderRadius: '8px', background: selectedUserId === profile.id ? '#CAD2C5' : '#fff', cursor: 'pointer', textAlign: 'left', fontWeight: selectedUserId === profile.id ? '600' : 'normal' }}>
                  <div style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {profile.email}
                    {profile.role === 'admin' && <span style={{ background: '#E74C3C', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem' }}>ADMIN</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sessionCount} sessions · {completedCount} completed</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="admin-header">
              <h1>TINA Analytics Dashboard</h1>
              <p style={{ color: '#6b7280', marginTop: '8px' }}>{selectedUser ? `Viewing: ${selectedUser.email}` : 'All users overview'}</p>
            </div>
            <div className="stats-grid">
              <div className="stat-card"><h3>Sessions</h3><div className="value">{filteredSessions.length}</div></div>
              <div className="stat-card"><h3>Completed</h3><div className="value">{completedSessions.length}</div></div>
              <div className="stat-card"><h3>Avg. Turns</h3><div className="value">{avgTurns}</div></div>
              <div className="stat-card"><h3>Completion Rate</h3><div className="value">{filteredSessions.length > 0 ? Math.round((completedSessions.length / filteredSessions.length) * 100) : 0}%</div></div>
            </div>
            <h2 style={{ marginTop: '24px', marginBottom: '16px', color: '#52796F' }}>Recent Sessions</h2>
            <div className="sessions-table">
              <table><thead><tr><th>User</th><th>Date</th><th>Turns</th><th>Status</th><th>Actions</th></tr></thead><tbody>
                {filteredSessions.slice(0, 20).map((session) => {
                  const sessionUser = users.find((profile) => profile.id === session.user_id);
                  return <tr key={session.id}><td style={{ fontSize: '0.85rem' }}>{sessionUser?.email || 'Unknown'}</td><td>{new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td>{session.turn_count || 0}</td><td><span className={`status-badge ${session.completed_at ? 'status-completed' : 'status-pending'}`}>{session.completed_at ? 'Completed' : 'In Progress'}</span></td><td>{session.completed_at && <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }} onClick={() => navigate(`/certificate/${session.id}`)}>View</button>}</td></tr>;
                })}
              </tbody></table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div>
          <h1 style={{ marginBottom: '24px' }}>NLP Analytics from session_analytics</h1>
          <div className="stats-grid">
            <div className="stat-card"><h3>Total Records</h3><div className="value">{sessionAnalytics.length}</div></div>
            <div className="stat-card"><h3>Avg Sentiment</h3><div className="value" style={{ color: parseFloat(avgSentiment) > 0.5 ? '#27AE60' : '#E74C3C' }}>{avgSentiment}</div></div>
            <div className="stat-card"><h3>Avg Engagement</h3><div className="value" style={{ color: '#3498DB' }}>{avgEngagement}</div></div>
            <div className="stat-card"><h3>Sessions Analyzed</h3><div className="value">{new Set(sessionAnalytics.map((a) => a.session_id)).size}</div></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '2px solid #E5E7EB' }}>
              <h3 style={{ marginBottom: '16px' }}>Emotion Distribution</h3>
              {Object.entries(emotionCounts).slice(0, 6).map(([emotion, count]) => <div key={emotion} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}><span style={{ width: '100px', textTransform: 'capitalize' }}>{emotion}</span><div style={{ flex: 1, background: '#E5E7EB', borderRadius: '4px', height: '20px', marginRight: '8px' }}><div style={{ width: `${(count / sessionAnalytics.length) * 100}%`, background: emotion === 'joy' ? '#27AE60' : emotion === 'sadness' ? '#3498DB' : '#F39C12', height: '100%', borderRadius: '4px' }} /></div><span style={{ width: '40px', textAlign: 'right' }}>{count}</span></div>)}
            </div>
            <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '2px solid #E5E7EB' }}>
              <h3 style={{ marginBottom: '16px' }}>AI Attitude Distribution</h3>
              {Object.entries(attitudeCounts).slice(0, 4).map(([attitude, count]) => <div key={attitude} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}><span style={{ width: '100px', textTransform: 'capitalize' }}>{attitude}</span><div style={{ flex: 1, background: '#E5E7EB', borderRadius: '4px', height: '20px', marginRight: '8px' }}><div style={{ width: `${(count / sessionAnalytics.length) * 100}%`, background: attitude === 'enthusiast' ? '#27AE60' : attitude === 'pragmatist' ? '#3498DB' : '#E74C3C', height: '100%', borderRadius: '4px' }} /></div><span style={{ width: '40px', textAlign: 'right' }}>{count}</span></div>)}
            </div>
          </div>
          <h3 style={{ marginTop: '24px', marginBottom: '16px' }}>Raw Analytics Data (Last 50)</h3>
          <div className="sessions-table">
            <table><thead><tr><th>Turn</th><th>Sentiment</th><th>Engagement</th><th>Emotion</th><th>AI Attitude</th><th>Efficacy</th><th>Date</th></tr></thead><tbody>
              {sessionAnalytics.slice(0, 50).map((record) => <tr key={record.id}><td>{record.turn_number}</td><td style={{ color: record.sentiment_score > 0.5 ? '#27AE60' : '#E74C3C' }}>{record.sentiment_score?.toFixed(2) || '-'}</td><td>{record.engagement_score?.toFixed(2) || '-'}</td><td>{record.emotion_label || '-'}</td><td>{record.ai_attitude || '-'}</td><td>{record.self_efficacy_level || '-'}</td><td>{new Date(record.created_at).toLocaleDateString()}</td></tr>)}
            </tbody></table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <h1 style={{ marginBottom: '24px' }}>User Management</h1>
          <p style={{ marginBottom: '24px', color: '#6b7280' }}>Toggle admin status for users. Admins can access the dashboard and update shared activity settings.</p>
          <div className="sessions-table">
            <table><thead><tr><th>Email</th><th>Role</th><th>Sessions</th><th>Joined</th><th>Actions</th></tr></thead><tbody>
              {users.map((dashboardUser) => {
                const sessionCount = sessions.filter((s) => s.user_id === dashboardUser.id).length;
                return <tr key={dashboardUser.id}><td>{dashboardUser.email}</td><td><span style={{ background: dashboardUser.role === 'admin' ? '#E74C3C' : '#27AE60', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600' }}>{dashboardUser.role?.toUpperCase() || 'USER'}</span></td><td>{sessionCount}</td><td>{new Date(dashboardUser.created_at).toLocaleDateString()}</td><td><button onClick={() => toggleAdminRole(dashboardUser.id, dashboardUser.role)} disabled={updatingRole === dashboardUser.id} style={{ padding: '8px 16px', background: dashboardUser.role === 'admin' ? '#E5E7EB' : '#F4D03F', border: 'none', borderRadius: '8px', cursor: updatingRole === dashboardUser.id ? 'wait' : 'pointer', fontWeight: '500' }}>{updatingRole === dashboardUser.id ? 'Updating...' : dashboardUser.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</button></td></tr>;
              })}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}
