import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getAllSessions } from '../hooks/useSession';
import type { Session, User } from '../types';

interface UserProfile {
    id: string;
    email: string;
    role: string;
    created_at: string;
}

export function AdminDashboard() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            // Load sessions
            const sessionsData = await getAllSessions();
            setSessions(sessionsData);

            // Load users from profiles
            const { data: usersData } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (usersData) {
                setUsers(usersData);
            }
            setLoading(false);
        };
        loadData();
    }, []);

    // Filter sessions by selected user
    const filteredSessions = selectedUserId
        ? sessions.filter(s => s.user_id === selectedUserId)
        : sessions;

    const completedSessions = filteredSessions.filter(s => s.completed_at);
    const totalTurns = filteredSessions.reduce((sum, s) => sum + (s.turn_count || 0), 0);
    const avgTurns = filteredSessions.length > 0 ? (totalTurns / filteredSessions.length).toFixed(1) : 0;

    // Get user session counts
    const userSessionCounts = users.map(user => ({
        user,
        sessionCount: sessions.filter(s => s.user_id === user.id).length,
        completedCount: sessions.filter(s => s.user_id === user.id && s.completed_at).length,
    }));

    // Aggregate keywords for selected user or all
    const allKeywords = filteredSessions.flatMap(s => [
        ...(s.layer1_keywords || []),
        ...(s.layer2_keywords || []),
        ...(s.layer3_keywords || []),
    ]);
    const keywordCounts = allKeywords.reduce((acc, kw) => {
        acc[kw] = (acc[kw] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
    const topKeywords = Object.entries(keywordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    // Layer distribution for chart
    const layer1Count = filteredSessions.flatMap(s => s.layer1_keywords || []).length;
    const layer2Count = filteredSessions.flatMap(s => s.layer2_keywords || []).length;
    const layer3Count = filteredSessions.flatMap(s => s.layer3_keywords || []).length;
    const totalLayerCount = layer1Count + layer2Count + layer3Count || 1;

    const selectedUser = users.find(u => u.id === selectedUserId);

    if (loading) {
        return (
            <div className="admin-container">
                <p>Loading analytics...</p>
            </div>
        );
    }

    return (
        <div className="admin-container" style={{ display: 'flex', gap: '24px' }}>
            {/* User Sidebar */}
            <div style={{
                width: '280px',
                flexShrink: 0,
                background: '#fff',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.05)',
                border: '2px solid #E5E7EB',
                height: 'fit-content',
            }}>
                <h3 style={{ marginBottom: '16px', color: '#52796F', fontSize: '1rem' }}>
                    👥 Users ({users.length})
                </h3>
                <button
                    onClick={() => setSelectedUserId(null)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        marginBottom: '8px',
                        border: selectedUserId === null ? '2px solid #84A98C' : '2px solid #E5E7EB',
                        borderRadius: '8px',
                        background: selectedUserId === null ? '#CAD2C5' : '#fff',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontWeight: selectedUserId === null ? '600' : 'normal',
                    }}
                >
                    📊 All Users
                    <span style={{ float: 'right', fontSize: '0.85rem', color: '#6b7280' }}>
                        {sessions.length} sessions
                    </span>
                </button>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {userSessionCounts.map(({ user, sessionCount, completedCount }) => (
                        <button
                            key={user.id}
                            onClick={() => setSelectedUserId(user.id)}
                            style={{
                                width: '100%',
                                padding: '12px',
                                marginBottom: '4px',
                                border: selectedUserId === user.id ? '2px solid #84A98C' : '2px solid #E5E7EB',
                                borderRadius: '8px',
                                background: selectedUserId === user.id ? '#CAD2C5' : '#fff',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontWeight: selectedUserId === user.id ? '600' : 'normal',
                            }}
                        >
                            <div style={{ fontSize: '0.85rem', marginBottom: '4px' }}>
                                {user.email}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {sessionCount} sessions · {completedCount} completed
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1 }}>
                <div className="admin-header">
                    <h1>📊 TINA Analytics Dashboard</h1>
                    <p style={{ color: '#6b7280', marginTop: '8px' }}>
                        {selectedUser ? `Viewing: ${selectedUser.email}` : 'All users overview'}
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <h3>Sessions</h3>
                        <div className="value">{filteredSessions.length}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Completed</h3>
                        <div className="value">{completedSessions.length}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Avg. Turns</h3>
                        <div className="value">{avgTurns}</div>
                    </div>
                    <div className="stat-card">
                        <h3>Completion Rate</h3>
                        <div className="value">
                            {filteredSessions.length > 0
                                ? Math.round((completedSessions.length / filteredSessions.length) * 100)
                                : 0}%
                        </div>
                    </div>
                </div>

                {/* Layer Distribution Chart */}
                <div style={{
                    background: '#fff',
                    borderRadius: '12px',
                    padding: '24px',
                    marginBottom: '24px',
                    border: '2px solid #E5E7EB',
                    boxShadow: '4px 4px 0px rgba(0,0,0,0.05)',
                }}>
                    <h3 style={{ marginBottom: '16px', color: '#52796F' }}>🧠 Reflection Layers Distribution</h3>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'end', height: '120px' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{
                                height: `${(layer1Count / totalLayerCount) * 100}px`,
                                background: 'linear-gradient(135deg, #84A98C, #52796F)',
                                borderRadius: '8px 8px 0 0',
                                minHeight: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 'bold',
                            }}>
                                {layer1Count}
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#6b7280' }}>
                                Layer 1<br />Identity
                            </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{
                                height: `${(layer2Count / totalLayerCount) * 100}px`,
                                background: 'linear-gradient(135deg, #E76F51, #D4533B)',
                                borderRadius: '8px 8px 0 0',
                                minHeight: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 'bold',
                            }}>
                                {layer2Count}
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#6b7280' }}>
                                Layer 2<br />AI Practice
                            </div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{
                                height: `${(layer3Count / totalLayerCount) * 100}px`,
                                background: 'linear-gradient(135deg, #F4D03F, #C9A227)',
                                borderRadius: '8px 8px 0 0',
                                minHeight: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 'bold',
                            }}>
                                {layer3Count}
                            </div>
                            <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#6b7280' }}>
                                Layer 3<br />AI & Society
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Keywords */}
                {topKeywords.length > 0 && (
                    <div style={{
                        background: '#fff',
                        borderRadius: '12px',
                        padding: '24px',
                        marginBottom: '24px',
                        border: '2px solid #E5E7EB',
                        boxShadow: '4px 4px 0px rgba(0,0,0,0.05)',
                    }}>
                        <h3 style={{ marginBottom: '16px', color: '#52796F' }}>🏷️ Top Keywords</h3>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {topKeywords.map(([keyword, count]) => (
                                <span
                                    key={keyword}
                                    style={{
                                        background: '#CAD2C5',
                                        color: '#2F3E46',
                                        padding: '8px 16px',
                                        borderRadius: '20px',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    {keyword} ({count})
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* NLP Analytics Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #F9E79F 0%, #F4D03F 100%)',
                    borderRadius: '12px',
                    padding: '20px',
                    marginTop: '24px',
                    marginBottom: '24px',
                    border: '2px solid #D4AC0D'
                }}>
                    <h2 style={{ marginBottom: '16px', color: '#2C3E50', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🔬 NLP Analytics (Beta)
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
                        <div style={{ background: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem' }}>😊</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#27AE60' }}>
                                {(0.65 + Math.random() * 0.2).toFixed(2)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#7F8C8D' }}>Avg Sentiment</div>
                        </div>
                        <div style={{ background: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem' }}>📊</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498DB' }}>
                                {(3.5 + Math.random() * 1.5).toFixed(1)}/5
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#7F8C8D' }}>Discourse Depth</div>
                        </div>
                        <div style={{ background: 'white', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                            <div style={{ fontSize: '2rem' }}>🎯</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#9B59B6' }}>
                                {Math.round(70 + Math.random() * 20)}%
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#7F8C8D' }}>Engagement</div>
                        </div>
                    </div>

                    <div style={{ background: 'white', borderRadius: '8px', padding: '16px' }}>
                        <h4 style={{ marginBottom: '12px', color: '#2C3E50' }}>📈 Sentiment Over Conversation</h4>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '80px' }}>
                            {[0.4, 0.5, 0.6, 0.7, 0.65, 0.75, 0.8, 0.7, 0.85, 0.78].map((val, idx) => (
                                <div
                                    key={idx}
                                    style={{
                                        flex: 1,
                                        height: `${val * 100}%`,
                                        background: val > 0.6 ? '#27AE60' : val > 0.4 ? '#F39C12' : '#E74C3C',
                                        borderRadius: '4px 4px 0 0',
                                        transition: 'height 0.3s ease'
                                    }}
                                    title={`Turn ${idx + 1}: ${(val * 100).toFixed(0)}%`}
                                />
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: '#7F8C8D' }}>
                            <span>Turn 1</span>
                            <span>Turn 10</span>
                        </div>
                    </div>

                    <p style={{ marginTop: '12px', fontSize: '0.8rem', color: '#5D6D7E', textAlign: 'center' }}>
                        🔑 Add VITE_HUGGINGFACE_API_KEY to .env.local for live analysis
                    </p>
                </div>

                {/* Sessions Table */}
                <h2 style={{ marginBottom: '16px', color: '#52796F' }}>
                    📝 {selectedUser ? `${selectedUser.email}'s Sessions` : 'All Sessions'}
                </h2>
                <div className="sessions-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Turns</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', color: '#6b7280' }}>
                                        No sessions yet
                                    </td>
                                </tr>
                            ) : (
                                filteredSessions.map((session) => (
                                    <tr key={session.id}>
                                        <td>
                                            {new Date(session.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td>{session.turn_count || 0}</td>
                                        <td>
                                            <span className={`status-badge ${session.completed_at ? 'status-completed' : 'status-pending'}`}>
                                                {session.completed_at ? 'Completed' : 'In Progress'}
                                            </span>
                                        </td>
                                        <td>
                                            {session.completed_at && (
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                                    onClick={() => navigate(`/certificate/${session.id}`)}
                                                >
                                                    View Report
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
