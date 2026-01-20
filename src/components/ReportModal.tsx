import React from 'react';
import { jsPDF } from 'jspdf';
import type { Session, TeacherCluster } from '../types';

// Cluster display information - PDF safe (no emojis for PDF, only for UI)
const CLUSTER_INFO: Record<TeacherCluster, {
    emoji: string;
    title: string;
    color: string;
    colorRGB: [number, number, number];
    description: string;
    shortLabel: string;
}> = {
    ethically_aware_hesitant: {
        emoji: '🤔',
        title: 'Ethically Aware but Hesitant',
        shortLabel: 'THOUGHTFUL EXPLORER',
        color: '#F59E0B',
        colorRGB: [245, 158, 11],
        description: 'You show strong ethical awareness about AI in education, but may hesitate when it comes to implementation.'
    },
    motivated_limited_supported: {
        emoji: '💪',
        title: 'Motivated but Limited Supported',
        shortLabel: 'DETERMINED PIONEER',
        color: '#3B82F6',
        colorRGB: [59, 130, 246],
        description: 'You are highly motivated to integrate AI, but may face resource or institutional support constraints.'
    },
    confident_ai_ready: {
        emoji: '🚀',
        title: 'Confident & AI-Ready',
        shortLabel: 'AI CHAMPION',
        color: '#10B981',
        colorRGB: [16, 185, 129],
        description: 'You demonstrate confidence and readiness in AI integration with strong support and resources.'
    }
};

interface ReportModalProps {
    session: Session;
    onClose: () => void;
    onNewSession: () => void;
}

export function ReportModal({ session, onClose, onNewSession }: ReportModalProps) {
    const parseReport = (report: string | null) => {
        if (!report) return null;

        const sections: { title: string; content: string }[] = [];
        const regex = /\*\*(\d+\).*?)\*\*([\s\S]*?)(?=\*\*\d+\)|$)/g;
        let match;

        while ((match = regex.exec(report)) !== null) {
            sections.push({
                title: match[1].trim(),
                content: match[2].trim(),
            });
        }

        return sections.length > 0 ? sections : null;
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        let yPosition = 0;
        const margin = 25;
        const maxWidth = pageWidth - margin * 2;

        // ===== COVER PAGE - Nanobanana Theme =====
        // Yellow gradient header
        doc.setFillColor(244, 208, 63);
        doc.rect(0, 0, pageWidth, 60, 'F');

        // Orange accent line
        doc.setFillColor(243, 156, 18);
        doc.rect(0, 60, pageWidth, 4, 'F');

        // Banana emblem circle
        doc.setFillColor(255, 255, 255);
        doc.circle(pageWidth / 2, 90, 22, 'F');
        doc.setFillColor(244, 208, 63);
        doc.circle(pageWidth / 2, 90, 18, 'F');

        // Emblem - Star icon (PDF safe, no emoji)
        doc.setFillColor(82, 121, 111);
        doc.circle(pageWidth / 2, 90, 12, 'F');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('T', pageWidth / 2, 94, { align: 'center' });

        // Main Title
        doc.setFontSize(32);
        doc.setTextColor(44, 62, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('TINA', pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(44, 62, 80);
        doc.text('Teacher Identity Navigation Assistant', pageWidth / 2, 48, { align: 'center' });

        // Report Title
        doc.setFontSize(22);
        doc.setTextColor(44, 62, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('Reflection Report', pageWidth / 2, 125, { align: 'center' });

        // Subtitle
        doc.setFontSize(12);
        doc.setTextColor(127, 140, 141);
        doc.setFont('helvetica', 'normal');
        doc.text('10-Minute Professional Consultation', pageWidth / 2, 138, { align: 'center' });

        // Date box
        const date = new Date(session.completed_at || session.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });

        doc.setFillColor(252, 243, 207);
        doc.roundedRect(margin + 30, 155, pageWidth - margin * 2 - 60, 25, 5, 5, 'F');
        doc.setFontSize(11);
        doc.setTextColor(212, 172, 13);
        doc.text(`Completed: ${date}`, pageWidth / 2, 170, { align: 'center' });

        // Bottom decorative line
        doc.setFillColor(243, 156, 18);
        doc.rect(margin + 50, 200, pageWidth - margin * 2 - 100, 2, 'F');

        // ===== CLUSTER BADGE ON COVER (Color Box) =====
        const clusterKey = session.teacher_cluster as TeacherCluster;
        if (clusterKey && CLUSTER_INFO[clusterKey]) {
            const info = CLUSTER_INFO[clusterKey];

            // Draw colored badge box
            doc.setFillColor(...info.colorRGB);
            doc.roundedRect(margin + 20, 205, pageWidth - margin * 2 - 40, 40, 5, 5, 'F');

            // Short label (big text)
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(info.shortLabel, pageWidth / 2, 220, { align: 'center' });

            // Full title
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(info.title, pageWidth / 2, 232, { align: 'center' });

            // Description below badge
            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            const descLines = doc.splitTextToSize(info.description, maxWidth - 20);
            doc.text(descLines, pageWidth / 2, 255, { align: 'center' });
        } else {
            // Motivational quote (fallback)
            doc.setFontSize(10);
            doc.setTextColor(127, 140, 141);
            doc.setFont('helvetica', 'italic');
            doc.text('"Teaching is the one profession that creates all other professions."', pageWidth / 2, 220, { align: 'center' });
        }

        // Footer on cover
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(127, 140, 141);
        doc.text('Powered by Nanobanana - TINA AI', pageWidth / 2, pageHeight - 20, { align: 'center' });

        // ===== CONTENT PAGES =====
        doc.addPage();
        yPosition = 25;

        // Page header - Yellow
        doc.setFillColor(244, 208, 63);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(10);
        doc.setTextColor(44, 62, 80);
        doc.text('TINA Reflection Report', pageWidth / 2, 10, { align: 'center' });

        yPosition = 30;

        // Section title style
        const drawSectionTitle = (title: string) => {
            if (yPosition > 250) {
                doc.addPage();
                // Add header to new page
                doc.setFillColor(244, 208, 63);
                doc.rect(0, 0, pageWidth, 15, 'F');
                doc.setFontSize(10);
                doc.setTextColor(44, 62, 80);
                doc.text('TINA Reflection Report', pageWidth / 2, 10, { align: 'center' });
                yPosition = 30;
            }

            // Section background - Yellow
            doc.setFillColor(244, 208, 63);
            doc.roundedRect(margin, yPosition - 5, maxWidth, 12, 2, 2, 'F');

            doc.setFontSize(11);
            doc.setTextColor(44, 62, 80);
            doc.setFont('helvetica', 'bold');
            doc.text(title, margin + 5, yPosition + 3);
            yPosition += 15;
        };

        const drawSectionContent = (content: string) => {
            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.setFont('helvetica', 'normal');

            const lines = doc.splitTextToSize(content, maxWidth - 10);
            lines.forEach((line: string) => {
                if (yPosition > 270) {
                    doc.addPage();
                    doc.setFillColor(82, 121, 111);
                    doc.rect(0, 0, pageWidth, 15, 'F');
                    doc.setFontSize(10);
                    doc.setTextColor(255, 255, 255);
                    doc.text('TINA Reflection Report', pageWidth / 2, 10, { align: 'center' });
                    yPosition = 30;
                    doc.setFontSize(10);
                    doc.setTextColor(47, 62, 70);
                }
                doc.text(line, margin + 5, yPosition);
                yPosition += 6;
            });
            yPosition += 8;
        };

        // Report content
        const sections = parseReport(session.summary_report);
        if (sections) {
            sections.forEach((section) => {
                drawSectionTitle(section.title);
                drawSectionContent(section.content);
            });
        } else if (session.summary_report) {
            drawSectionTitle('Reflection Summary');
            drawSectionContent(session.summary_report);
        }

        // ===== ADD PAGE NUMBERS =====
        const pageCount = doc.internal.pages.length - 1;
        for (let i = 2; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Page ${i - 1} of ${pageCount - 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }

        doc.save(`tina-report-${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    const sections = parseReport(session.summary_report);
    const date = new Date(session.completed_at || session.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>

                <div className="report-card">
                    <div className="report-emblem" style={{
                        background: 'linear-gradient(135deg, #F4D03F 0%, #F39C12 100%)',
                        color: '#2C3E50',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        fontFamily: 'Georgia, serif'
                    }}>T</div>

                    <div className="report-header">
                        <h1>TINA Reflection Report</h1>
                        <p>Teacher Identity Navigation Assistant</p>
                        <p className="report-date">Completed on {date}</p>
                    </div>

                    {/* Cluster Badge */}
                    {session.teacher_cluster && CLUSTER_INFO[session.teacher_cluster as TeacherCluster] && (
                        <div
                            className="cluster-badge"
                            style={{
                                backgroundColor: CLUSTER_INFO[session.teacher_cluster as TeacherCluster].color + '20',
                                borderColor: CLUSTER_INFO[session.teacher_cluster as TeacherCluster].color,
                                borderWidth: '2px',
                                borderStyle: 'solid',
                                borderRadius: '12px',
                                padding: '16px 20px',
                                marginBottom: '20px',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                                {CLUSTER_INFO[session.teacher_cluster as TeacherCluster].emoji}
                            </div>
                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '1.1rem',
                                color: CLUSTER_INFO[session.teacher_cluster as TeacherCluster].color,
                                marginBottom: '8px'
                            }}>
                                {CLUSTER_INFO[session.teacher_cluster as TeacherCluster].title}
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#666' }}>
                                {CLUSTER_INFO[session.teacher_cluster as TeacherCluster].description}
                            </div>
                        </div>
                    )}

                    <div className="report-body">
                        {sections ? (
                            sections.map((section, idx) => (
                                <div className="report-section" key={idx}>
                                    <h3>{section.title}</h3>
                                    <p>{section.content}</p>
                                </div>
                            ))
                        ) : (
                            <div className="report-section">
                                <h3>Reflection Summary</h3>
                                <p>{session.summary_report || 'Reflection complete.'}</p>
                            </div>
                        )}
                    </div>

                    <div className="report-footer">
                        <p>Session ID: {session.id.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn btn-primary" onClick={downloadPDF}>
                        📥 Download PDF
                    </button>
                    <button className="btn btn-secondary" onClick={onNewSession}>
                        🔄 New Session
                    </button>
                </div>
            </div>
        </div>
    );
}
