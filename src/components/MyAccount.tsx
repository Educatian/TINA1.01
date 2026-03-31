import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../hooks/useAuth';
import { getUserSessions } from '../hooks/useSession';
import type { Message, Session } from '../types';

export function MyAccount() {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState<Session | null>(null);
    const [viewingChat, setViewingChat] = useState<Session | null>(null);
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

    const downloadTXT = (session: Session) => {
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
        saveAs(blob, `tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.txt`);
    };

    const downloadWord = async (session: Session) => {
        const messages = getMessages(session);
        const children: Paragraph[] = [];

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

    const downloadPDF = (session: Session) => {
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
                        <button className="modal-close" onClick={() => setViewingChat(null)}>x</button>

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

            <div className="account-section">
                <h2>My Reflection Sessions</h2>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                    Revisit past conversations, continue unfinished ones, or keep a copy of your work.
                </p>

                {loading ? (
                    <p>Loading your sessions...</p>
                ) : sessions.length === 0 ? (
                    <div className="empty-state">
                        <p>You have not started a reflection yet.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>
                            Start Your First Reflection
                        </button>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {sessions.map((session) => (
                            <div key={session.id} className="session-card">
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
                                </div>

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
                    </div>
                )}
            </div>

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
