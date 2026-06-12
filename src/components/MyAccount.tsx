import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
// Heavy export libs (jspdf, html2canvas, docx, file-saver ≈ 0.9MB combined) are
// dynamically imported inside each download handler so visiting /account does
// not pay for an export the user may never trigger.
import { useAuth } from '../hooks/useAuth';
import { getUserSessions, deleteUserSessions } from '../hooks/useSession';
import { ReflectionJourney } from './ReflectionJourney';
import { LearnerInsights } from './LearnerInsights';
import { CollapsibleSection } from './CollapsibleSection';
import { getUserFeedback, requestInstructorFeedback, type SessionFeedback } from '../services/feedbackService';
import type { Message, Session } from '../types';

// Only the most recent sessions render by default; the rest sit behind a
// "Show all" toggle so the page stays short for learners with long histories.
const RECENT_SESSION_COUNT = 5;

export function MyAccount() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [viewingChat, setViewingChat] = useState<Session | null>(null);
    const [feedbackBySession, setFeedbackBySession] = useState<Record<string, SessionFeedback>>({});
    const [requestingId, setRequestingId] = useState<string | null>(null);
    const [showAllSessions, setShowAllSessions] = useState(false);
    const [selectMode, setSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [deleting, setDeleting] = useState(false);
    const chatViewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (user) {
            void loadSessions();
        }
    }, [user]);

    const loadSessions = async () => {
        if (!user) return;
        const data = await getUserSessions(user.id);
        setSessions(data);
        setLoading(false);
        const feedback = await getUserFeedback(user.id);
        const map: Record<string, SessionFeedback> = {};
        feedback.forEach((f) => { map[f.session_id] = f; });
        setFeedbackBySession(map);
    };

    const handleRequestFeedback = async (session: Session) => {
        if (!user) return;
        setRequestingId(session.id);
        const ok = await requestInstructorFeedback({
            sessionId: session.id,
            userId: user.id,
            activityId: session.activity_id ?? null,
        });
        setRequestingId(null);
        if (ok) {
            setFeedbackBySession((prev) => ({
                ...prev,
                [session.id]: { ...(prev[session.id] || {} as SessionFeedback), session_id: session.id, user_id: user.id, requested: true, status: 'requested' },
            }));
        }
    };

    const getMessages = (session: Session): Message[] => {
        if (!session.messages) return [];
        if (typeof session.messages === 'string') {
            try {
                return JSON.parse(session.messages);
            } catch {
                return [];
            }
        }
        return session.messages as Message[];
    };

    const downloadTXT = async (session: Session) => {
        const messages = getMessages(session);
        let content = 'TINA Chat Log\n';
        content += `Date: ${new Date(session.created_at).toLocaleDateString()}\n`;
        content += `Turns: ${session.turn_count}\n`;
        content += `${'='.repeat(50)}\n\n`;

        messages.forEach((msg) => {
            const role = msg.role === 'user' ? 'You' : 'TINA';
            content += `[${role}]\n${msg.text}\n\n`;
        });

        if (session.summary_report) {
            content += `\n${'='.repeat(50)}\n`;
            content += `REFLECTION SUMMARY\n${'='.repeat(50)}\n\n`;
            content += session.summary_report;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const { saveAs } = await import('file-saver');
        saveAs(blob, `tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.txt`);
    };

    const downloadWord = async (session: Session) => {
        const [{ Document, HeadingLevel, Packer, Paragraph, TextRun }, { saveAs }] = await Promise.all([
            import('docx'),
            import('file-saver'),
        ]);
        const messages = getMessages(session);
        const children: InstanceType<typeof Paragraph>[] = [];

        children.push(new Paragraph({
            text: 'TINA Chat Log',
            heading: HeadingLevel.HEADING_1,
        }));

        children.push(new Paragraph({
            children: [
                new TextRun({ text: `Date: ${new Date(session.created_at).toLocaleDateString()}`, break: 1 }),
                new TextRun({ text: `Turns: ${session.turn_count}`, break: 1 }),
            ],
        }));

        children.push(new Paragraph({ text: '' }));

        messages.forEach((msg) => {
            const role = msg.role === 'user' ? 'You' : 'TINA';
            children.push(new Paragraph({
                children: [new TextRun({ text: `[${role}]`, bold: true })],
            }));
            children.push(new Paragraph({ text: msg.text }));
            children.push(new Paragraph({ text: '' }));
        });

        if (session.summary_report) {
            children.push(new Paragraph({
                text: 'Reflection Summary',
                heading: HeadingLevel.HEADING_2,
            }));
            children.push(new Paragraph({ text: session.summary_report }));
        }

        const doc = new Document({
            sections: [{ children }],
        });

        const blob = await Packer.toBlob(doc);
        saveAs(blob, `tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.docx`);
    };

    const downloadPDF = async (session: Session) => {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const maxWidth = pageWidth - 50;
        let yPosition = 25;

        doc.setFontSize(26);
        doc.setTextColor(44, 62, 80);
        doc.text('TINA', pageWidth / 2, 24, { align: 'center' });

        doc.setFontSize(12);
        doc.text('Reflection Chat Log', pageWidth / 2, 34, { align: 'center' });
        doc.setFontSize(10);
        doc.setTextColor(127, 140, 141);
        doc.text(
            `Date: ${new Date(session.created_at).toLocaleDateString()} | Turns: ${session.turn_count}`,
            pageWidth / 2,
            42,
            { align: 'center' },
        );

        yPosition = 55;
        const messages = getMessages(session);

        messages.forEach((msg) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 25;
            }

            const role = msg.role === 'user' ? 'You' : 'TINA';
            doc.setFontSize(10);
            doc.setTextColor(msg.role === 'user' ? 93 : 244, msg.role === 'user' ? 173 : 208, msg.role === 'user' ? 226 : 63);
            doc.text(`[${role}]`, 25, yPosition);
            yPosition += 6;

            doc.setTextColor(44, 62, 80);
            const lines = doc.splitTextToSize(msg.text, maxWidth);
            lines.forEach((line: string) => {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 25;
                }
                doc.text(line, 25, yPosition);
                yPosition += 5;
            });
            yPosition += 8;
        });

        doc.save(`tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.pdf`);
    };

    const downloadScreenshot = async () => {
        if (!chatViewRef.current) return;

        const [{ default: html2canvas }, { saveAs }] = await Promise.all([
            import('html2canvas'),
            import('file-saver'),
        ]);
        const canvas = await html2canvas(chatViewRef.current, {
            backgroundColor: '#FFFEF7',
            scale: 2,
        });

        canvas.toBlob((blob) => {
            if (blob) {
                saveAs(blob, `tina-chat-screenshot-${new Date().toISOString().slice(0, 10)}.png`);
            }
        });
    };

    const toggleSelected = (sessionId: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(sessionId)) next.delete(sessionId);
            else next.add(sessionId);
            return next;
        });
    };

    const exitSelectMode = () => {
        setSelectMode(false);
        setSelectedIds(new Set());
    };

    const handleDeleteSelected = async () => {
        if (!user || selectedIds.size === 0 || deleting) return;
        const count = selectedIds.size;
        const ok = window.confirm(
            `Delete ${count} ${count === 1 ? 'session' : 'sessions'}?\n\n` +
            'This permanently removes the selected conversations, their reflection reports, and their telemetry. This cannot be undone.',
        );
        if (!ok) return;
        setDeleting(true);
        const result = await deleteUserSessions(user.id, [...selectedIds]);
        setDeleting(false);
        if (result.error) {
            window.alert(`Could not delete: ${result.error}`);
            return;
        }
        if (result.deleted === 0) {
            window.alert('Could not delete — the server has not enabled session deletion yet. (Admin: apply tina-session-delete.sql in the Supabase SQL Editor.)');
            return;
        }
        // Drop anything that referenced a deleted session, then re-sync.
        if (selectedSession && selectedIds.has(selectedSession.id)) setSelectedSession(null);
        if (viewingChat && selectedIds.has(viewingChat.id)) setViewingChat(null);
        setSessions((prev) => prev.filter((s) => !selectedIds.has(s.id)));
        exitSelectMode();
        if (result.deleted < count) {
            window.alert(`Deleted ${result.deleted} of ${count} — the rest could not be removed. Refresh and try again.`);
            void loadSessions();
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    if (!user) return null;

    return (
        <div className="account-container">
            <div className="account-header">
                <h1>My Account</h1>
                <p>Review your reflections, continue unfinished sessions, or export a copy for later.</p>
            </div>

            {viewingChat && (
                <div className="modal-overlay" onClick={() => setViewingChat(null)}>
                    <div className="modal-content chat-viewer-modal" onClick={(e) => e.stopPropagation()}>
                        <button
                            className="modal-close"
                            onClick={() => setViewingChat(null)}
                            aria-label="Close chat history"
                        >
                            ×
                        </button>

                        <div className="chat-viewer-header">
                            <h2>Chat History</h2>
                            <p>{new Date(viewingChat.created_at).toLocaleDateString()} • {viewingChat.turn_count} turns</p>
                        </div>

                        <div className="chat-viewer-content" ref={chatViewRef}>
                            {getMessages(viewingChat).map((msg, idx) => (
                                <div key={idx} className={`chat-viewer-msg ${msg.role}`}>
                                    <span className="msg-role">{msg.role === 'user' ? 'You' : 'TINA'}</span>
                                    <p>{msg.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="chat-viewer-actions">
                            <button className="btn btn-secondary" onClick={() => downloadTXT(viewingChat)}>
                                Export TXT
                            </button>
                            <button className="btn btn-secondary" onClick={() => downloadWord(viewingChat)}>
                                Export Word
                            </button>
                            <button className="btn btn-secondary" onClick={() => downloadPDF(viewingChat)}>
                                Export PDF
                            </button>
                            <button className="btn btn-primary" onClick={downloadScreenshot}>
                                Save Screenshot
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!loading && <ReflectionJourney sessions={sessions} />}
            {!loading && user && <LearnerInsights userId={user.id} />}

            <CollapsibleSection
                storageKey="sessions"
                title="My Reflection Sessions"
                summary={`${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`}
                defaultOpen
            >
                <div className="sessions-toolbar">
                    <p style={{ color: '#6b7280', margin: 0 }}>
                        Revisit past conversations, continue unfinished ones, or keep a copy of your work.
                    </p>
                    {sessions.length > 0 && !selectMode && (
                        <button className="btn btn-secondary sessions-select-toggle" onClick={() => setSelectMode(true)}>
                            Select
                        </button>
                    )}
                </div>

                {selectMode && (
                    <div className="session-select-bar" role="toolbar" aria-label="Session selection">
                        <span className="select-count">
                            {selectedIds.size} selected
                        </span>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedIds(
                                selectedIds.size === sessions.length
                                    ? new Set()
                                    : new Set(sessions.map((s) => s.id)),
                            )}
                        >
                            {selectedIds.size === sessions.length ? 'Clear all' : `Select all ${sessions.length}`}
                        </button>
                        <button
                            className="btn btn-danger"
                            disabled={selectedIds.size === 0 || deleting}
                            onClick={handleDeleteSelected}
                        >
                            {deleting ? 'Deleting…' : `Delete${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
                        </button>
                        <button className="btn btn-secondary" onClick={exitSelectMode} disabled={deleting}>
                            Done
                        </button>
                    </div>
                )}

                {loading ? (
                    <p>Loading your sessions…</p>
                ) : sessions.length === 0 ? (
                    <div className="empty-state">
                        <p>You have not started a reflection yet.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>
                            Start Your First Reflection
                        </button>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {(showAllSessions || selectMode ? sessions : sessions.slice(0, RECENT_SESSION_COUNT)).map((session) => (
                            <div key={session.id} className={`session-card ${selectMode && selectedIds.has(session.id) ? 'session-card-selected' : ''}`}>
                                {selectMode && (
                                    <input
                                        type="checkbox"
                                        className="session-check"
                                        checked={selectedIds.has(session.id)}
                                        onChange={() => toggleSelected(session.id)}
                                        aria-label={`Select session from ${new Date(session.created_at).toLocaleDateString()}`}
                                    />
                                )}
                                <div className="session-info">
                                    <h3>
                                        {session.completed_at ? 'Completed reflection' : 'In-progress reflection'} on{' '}
                                        {new Date(session.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                        })}
                                    </h3>
                                    <p>
                                        {session.turn_count} turns • {session.completed_at ? 'Completed' : 'In progress'}
                                    </p>
                                </div>

                                <div className="session-actions">
                                    <button className="btn btn-primary" onClick={() => setViewingChat(session)}>
                                        View Chat
                                    </button>
                                    {!session.completed_at && (
                                        <button
                                            className="btn btn-accent"
                                            onClick={() => navigate('/', { state: { resumeSession: session } })}
                                        >
                                            Continue
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                                    >
                                        {selectedSession?.id === session.id ? 'Hide Preview' : 'Preview'}
                                    </button>
                                    {session.completed_at && !feedbackBySession[session.id]?.requested && !feedbackBySession[session.id]?.feedback_text && (
                                        <button
                                            className="btn btn-secondary"
                                            disabled={requestingId === session.id}
                                            onClick={() => handleRequestFeedback(session)}
                                        >
                                            {requestingId === session.id ? 'Requesting…' : 'Ask instructor for feedback'}
                                        </button>
                                    )}
                                </div>

                                {feedbackBySession[session.id]?.feedback_text ? (
                                    <div className="session-feedback session-feedback-answered">
                                        <strong>Instructor feedback</strong>
                                        <p>{feedbackBySession[session.id]?.feedback_text}</p>
                                    </div>
                                ) : feedbackBySession[session.id]?.requested ? (
                                    <div className="session-feedback session-feedback-pending">
                                        Feedback requested, your instructor will reply here.
                                    </div>
                                ) : null}

                                {selectedSession?.id === session.id && (
                                    <div className="session-preview">
                                        {getMessages(session).slice(0, 4).map((msg, idx) => (
                                            <div key={idx} className="preview-msg">
                                                <strong>{msg.role === 'user' ? 'You:' : 'TINA:'}</strong>
                                                <span>{msg.text.slice(0, 100)}...</span>
                                            </div>
                                        ))}
                                        {getMessages(session).length > 4 && (
                                            <p style={{ textAlign: 'center', color: '#7F8C8D' }}>
                                                ... and {getMessages(session).length - 4} more messages
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                        {sessions.length > RECENT_SESSION_COUNT && !selectMode && (
                            <button
                                className="btn btn-secondary show-all-sessions"
                                onClick={() => setShowAllSessions((v) => !v)}
                            >
                                {showAllSessions
                                    ? `Show recent ${RECENT_SESSION_COUNT} only`
                                    : `Show all ${sessions.length} sessions`}
                            </button>
                        )}
                    </div>
                )}
            </CollapsibleSection>

            <div className="account-section">
                <h2>Account Settings</h2>
                <div className="account-info">
                    <p><strong>Email:</strong> {user.email}</p>
                    <p><strong>Role:</strong> {user.role}</p>
                    <p><strong>Member since:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
                <button className="btn btn-secondary" onClick={handleSignOut}>
                    Sign Out
                </button>
            </div>
        </div>
    );
}
