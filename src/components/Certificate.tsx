import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSession } from '../hooks/useSession';
import type { Session } from '../types';
import html2canvas from 'html2canvas';

export function Certificate() {
    const { sessionId } = useParams<{ sessionId: string }>();
    const navigate = useNavigate();
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSession = async () => {
            if (sessionId) {
                const data = await getSession(sessionId);
                setSession(data);
            }
            setLoading(false);
        };
        loadSession();
    }, [sessionId]);

    const downloadImage = async () => {
        const element = document.getElementById('certificate-content');
        if (!element) return;

        try {
            const canvas = await html2canvas(element, {
                scale: 2,
                backgroundColor: '#FDFBF7',
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `tina-certificate-${new Date().toISOString().slice(0, 10)}.png`;
            link.click();
        } catch (err) {
            console.error('Failed to download image:', err);
        }
    };

    const downloadText = () => {
        if (!session) return;

        const content = `TINA Reflection Report
Generated: ${new Date(session.completed_at || session.created_at).toLocaleDateString()}

${session.summary_report || 'No summary available.'}
`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tina-report-${new Date().toISOString().slice(0, 10)}.txt`;
        link.click();
    };

    const parseReport = (report: string | null) => {
        if (!report) return null;

        // Simple parsing of the report sections
        const sections: { [key: string]: string } = {};
        const regex = /\*\*(\d+\).*?)\*\*([\s\S]*?)(?=\*\*\d+\)|$)/g;
        let match;

        while ((match = regex.exec(report)) !== null) {
            sections[match[1].trim()] = match[2].trim();
        }

        return sections;
    };

    if (loading) {
        return (
            <div className="certificate-container">
                <p>Loading your certificate...</p>
            </div>
        );
    }

    if (!session) {
        return (
            <div className="certificate-container">
                <p>Session not found.</p>
                <button className="btn btn-primary" onClick={() => navigate('/')}>
                    Go Home
                </button>
            </div>
        );
    }

    const reportSections = parseReport(session.summary_report);
    const date = new Date(session.completed_at || session.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="certificate-container">
            <div className="certificate-card" id="certificate-content">
                <div className="certificate-emblem">🎓</div>

                <div className="certificate-header">
                    <h1>TINA Reflection Report</h1>
                    <p>Teacher Identity Navigation Assistant</p>
                    <p style={{ marginTop: '8px', fontSize: '0.9rem', color: '#6b7280' }}>
                        10-Minute Consultation Certificate
                    </p>
                </div>

                {reportSections ? (
                    <>
                        {Object.entries(reportSections).map(([title, content]) => (
                            <div className="certificate-section" key={title}>
                                <h3>{title}</h3>
                                <p style={{ whiteSpace: 'pre-wrap' }}>{content}</p>
                            </div>
                        ))}
                    </>
                ) : (
                    <div className="certificate-section">
                        <h3>Reflection Summary</h3>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{session.summary_report || 'Reflection complete.'}</p>
                    </div>
                )}

                <div className="certificate-footer">
                    <p className="certificate-date">
                        Completed on {date}
                    </p>
                    <p style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9CA3AF' }}>
                        Session ID: {session.id.slice(0, 8)}...
                    </p>
                </div>
            </div>

            <div className="certificate-actions">
                <button className="btn btn-secondary" onClick={downloadText}>
                    📄 Download TXT
                </button>
                <button className="btn btn-primary" onClick={downloadImage}>
                    🖼️ Download Image
                </button>
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                    🏠 New Session
                </button>
            </div>
        </div>
    );
}
