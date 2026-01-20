import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { useAuth } from '../hooks/useAuth';
import { getUserSessions } from '../hooks/useSession';
import type { Session, Message } from '../types';

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
            loadSessions();
        }
    }, [user]);

    const loadSessions = async () => {
        if (!user) return;
        const data = await getUserSessions(user.id);
        setSessions(data);
        setLoading(false);
    };

    const parseReport = (report: string | null) => {
        if (!report) return null;
        const sections: { title: string; content: string }[] = [];
        const regex = /\*\*(\d+\).*?)\*\*([\s\S]*?)(?=\*\*\d+\)|$)/g;
        let match;
        while ((match = regex.exec(report)) !== null) {
            sections.push({ title: match[1].trim(), content: match[2].trim() });
        }
        return sections.length > 0 ? sections : null;
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

    // Download as TXT
    const downloadTXT = (session: Session) => {
        const messages = getMessages(session);
        let content = `TINA Chat Log\n`;
        content += `Date: ${new Date(session.created_at).toLocaleDateString()}\n`;
        content += `Turns: ${session.turn_count}\n`;
        content += `${'='.repeat(50)}\n\n`;

        messages.forEach((msg) => {
            const role = msg.role === 'user' ? 'You' : 'TINA';
            content += `[${role}]\n${msg.text}\n\n`;
        });

        if (session.summary_report) {
            content += `\n${'='.repeat(50)}\n`;
            content += `REFLECTION REPORT\n${'='.repeat(50)}\n\n`;
            content += session.summary_report;
        }

        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        saveAs(blob, `tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.txt`);
    };

    // Download as Word
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
                children: [
                    new TextRun({ text: `[${role}]`, bold: true }),
                ],
            }));
            children.push(new Paragraph({ text: msg.text }));
            children.push(new Paragraph({ text: '' }));
        });

        if (session.summary_report) {
            children.push(new Paragraph({
                text: 'Reflection Report',
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

    // Download as PDF (report style)
    const downloadPDF = (session: Session) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 0;
        const margin = 25;
        const maxWidth = pageWidth - margin * 2;

        // Cover page
        doc.setFillColor(244, 208, 63);
        doc.rect(0, 0, pageWidth, 60, 'F');
        doc.setFillColor(243, 156, 18);
        doc.rect(0, 60, pageWidth, 4, 'F');

        doc.setFontSize(32);
        doc.setTextColor(44, 62, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('TINA', pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Teacher Identity Navigation Assistant', pageWidth / 2, 48, { align: 'center' });

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Chat Log', pageWidth / 2, 100, { align: 'center' });

        const date = new Date(session.created_at).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        doc.setFontSize(11);
        doc.setTextColor(127, 140, 141);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${date} | Turns: ${session.turn_count}`, pageWidth / 2, 115, { align: 'center' });

        // Chat content
        doc.addPage();
        yPosition = 25;

        const messages = getMessages(session);
        messages.forEach((msg) => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 25;
            }

            const role = msg.role === 'user' ? 'You' : 'TINA';
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            if (msg.role === 'user') {
                doc.setTextColor(93, 173, 226);
            } else {
                doc.setTextColor(244, 208, 63);
            }
            doc.text(`[${role}]`, margin, yPosition);
            yPosition += 6;

            doc.setFont('helvetica', 'normal');
            doc.setTextColor(44, 62, 80);
            const lines = doc.splitTextToSize(msg.text, maxWidth);
            lines.forEach((line: string) => {
                if (yPosition > 280) {
                    doc.addPage();
                    yPosition = 25;
                }
                doc.text(line, margin, yPosition);
                yPosition += 5;
            });
            yPosition += 8;
        });

        doc.save(`tina-chat-${new Date(session.created_at).toISOString().slice(0, 10)}.pdf`);
    };

    // Download as Screenshot
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

    if (!user) {
        return null;
    }

    return (
        <div className="account-container">
            <div className="account-header">
                <h1>👤 My Account</h1>
                <p>Welcome, {user.email}</p>
            </div>

            {/* Chat Viewer Modal */}
            {viewingChat && (
                <div className="modal-overlay" onClick={() => setViewingChat(null)}>
                    <div className="modal-content chat-viewer-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setViewingChat(null)}>×</button>

                        <div className="chat-viewer-header">
                            <h2>📜 Chat History</h2>
                            <p>{new Date(viewingChat.created_at).toLocaleDateString()} • {viewingChat.turn_count} turns</p>
                        </div>

                        <div className="chat-viewer-content" ref={chatViewRef}>
                            {getMessages(viewingChat).map((msg, idx) => (
                                <div key={idx} className={`chat-viewer-msg ${msg.role}`}>
                                    <span className="msg-role">{msg.role === 'user' ? '👤 You' : '🍌 TINA'}</span>
                                    <p>{msg.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="chat-viewer-actions">
                            <button className="btn btn-secondary" onClick={() => downloadTXT(viewingChat)}>
                                📄 TXT
                            </button>
                            <button className="btn btn-secondary" onClick={() => downloadWord(viewingChat)}>
                                📝 Word
                            </button>
                            <button className="btn btn-secondary" onClick={() => downloadPDF(viewingChat)}>
                                📕 PDF
                            </button>
                            <button className="btn btn-primary" onClick={downloadScreenshot}>
                                📸 Screenshot
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="account-section">
                <h2>📋 My Chat Sessions</h2>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                    View, load, and download your past TINA conversations
                </p>

                {loading ? (
                    <p>Loading your sessions...</p>
                ) : sessions.length === 0 ? (
                    <div className="empty-state">
                        <p>You haven't had any conversations yet.</p>
                        <button className="btn btn-primary" onClick={() => navigate('/')}>
                            Start Your First Session
                        </button>
                    </div>
                ) : (
                    <div className="sessions-list">
                        {sessions.map((session) => (
                            <div key={session.id} className="session-card">
                                <div className="session-info">
                                    <h3>
                                        {session.completed_at ? '🎓' : '💬'} Session on {new Date(session.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric', month: 'short', day: 'numeric'
                                        })}
                                    </h3>
                                    <p>
                                        {session.turn_count} turns •
                                        {session.completed_at ? ' Completed' : ' In Progress'}
                                    </p>
                                </div>
                                <div className="session-actions">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => setViewingChat(session)}
                                    >
                                        👁️ View Chat
                                    </button>
                                    {!session.completed_at && (
                                        <button
                                            className="btn btn-accent"
                                            onClick={() => navigate('/', { state: { resumeSession: session } })}
                                        >
                                            ▶️ Continue
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
                                    >
                                        {selectedSession?.id === session.id ? '🔼 Hide' : '🔽 Preview'}
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
                <h2>⚙️ Account Settings</h2>
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
