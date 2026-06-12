import React, { useEffect, useState } from 'react';
import {
    extractCarryQuestions,
    getCoachingTurnsForSession,
    saveCarryForward,
    computeJol,
    type TrajectoryPoint,
    type DepthBand,
} from '../services/reflectionLoop';
import { saveJol } from '../services/analyticsService';
import { requestInstructorFeedback } from '../services/feedbackService';
import { TinaAvatar } from './TinaAvatar';

const JOL_OPTIONS: { band: DepthBand; label: string; hint: string }[] = [
    { band: 1, label: 'Mostly described what happened', hint: 'I shared the situation' },
    { band: 2, label: 'Started examining why', hint: 'I touched on the reasons' },
    { band: 3, label: 'Really dug into the why', hint: 'I questioned my values and assumptions' },
];

const BAND_LABEL: Record<DepthBand, string> = {
    1: 'mostly describing',
    2: 'starting to examine why',
    3: 'examining the why',
};
import type { Session, TeacherCluster } from '../types';

const LEVEL_HEIGHT: Record<TrajectoryPoint['reflectionLevel'], number> = {
    technical: 1,
    descriptive: 2,
    critical: 3,
};

const LEVEL_LABEL: Record<TrajectoryPoint['reflectionLevel'], string> = {
    technical: 'Brief',
    descriptive: 'Describing',
    critical: 'Examining why',
};

const CLUSTER_INFO: Record<TeacherCluster, {
    title: string;
    color: string;
    colorRGB: [number, number, number];
    description: string;
    shortLabel: string;
}> = {
    ethically_aware_hesitant: {
        title: 'Ethically Aware but Hesitant',
        shortLabel: 'Thoughtful Explorer',
        color: '#F59E0B',
        colorRGB: [245, 158, 11],
        description: 'You show strong ethical awareness about AI in education, while still feeling cautious about how to apply it.',
    },
    motivated_limited_supported: {
        title: 'Motivated but Limited Supported',
        shortLabel: 'Determined Pioneer',
        color: '#3B82F6',
        colorRGB: [59, 130, 246],
        description: 'You are motivated to use AI meaningfully, but support, time, or resources may still feel limited.',
    },
    confident_ai_ready: {
        title: 'Confident and AI-Ready',
        shortLabel: 'AI Champion',
        color: '#10B981',
        colorRGB: [16, 185, 129],
        description: 'You show confidence and readiness in using AI with thoughtful judgment and a clear sense of purpose.',
    },
};

interface ReportModalProps {
    session: Session;
    onClose: () => void;
    onNewSession: () => void;
}

export function ReportModal({ session, onClose, onNewSession }: ReportModalProps) {
    const [trajectory, setTrajectory] = useState<TrajectoryPoint[]>([]);
    const [carriedQuestion, setCarriedQuestion] = useState<string | null>(null);
    // JOL gate: ask the learner how deep they FELT they went BEFORE revealing
    // the summary, so the self-rating is not anchored by what TINA reflects back.
    const [jolRating, setJolRating] = useState<DepthBand | null>(null);
    const [feedbackNote, setFeedbackNote] = useState('');
    const [feedbackState, setFeedbackState] = useState<'idle' | 'sending' | 'sent'>('idle');

    useEffect(() => {
        let cancelled = false;
        getCoachingTurnsForSession(session.id).then((points) => {
            if (!cancelled) setTrajectory(points);
        });
        return () => { cancelled = true; };
    }, [session.id]);

    const jol = jolRating ? computeJol(jolRating, trajectory) : null;
    // The gate only makes sense when we have measurable depth (treatment arm).
    const jolApplicable = trajectory.length >= 3;
    const reportRevealed = !jolApplicable || jolRating !== null;

    const handleJolSelect = (band: DepthBand) => {
        setJolRating(band);
        const result = computeJol(band, trajectory);
        void saveJol(session.id, {
            rating: result.selfRating,
            measuredBand: result.measuredBand,
            measuredScore: result.measuredScore,
            gap: result.gap,
        });
    };

    const carryQuestions = extractCarryQuestions(session.summary_report);

    const handleCarrySelect = (question: string) => {
        setCarriedQuestion(question);
        void saveCarryForward(session.user_id, session.id, question);
    };

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

    const downloadPDF = async () => {
        // jsPDF (~350KB) is the single heaviest dependency and is only needed
        // when a learner actually downloads — load it on click, not on boot.
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 25;
        const maxWidth = pageWidth - margin * 2;
        let yPosition = 0;

        doc.setFillColor(244, 208, 63);
        doc.rect(0, 0, pageWidth, 60, 'F');
        doc.setFillColor(243, 156, 18);
        doc.rect(0, 60, pageWidth, 4, 'F');

        doc.setFillColor(255, 255, 255);
        doc.circle(pageWidth / 2, 90, 22, 'F');
        doc.setFillColor(244, 208, 63);
        doc.circle(pageWidth / 2, 90, 18, 'F');
        doc.setFillColor(82, 121, 111);
        doc.circle(pageWidth / 2, 90, 12, 'F');
        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.text('T', pageWidth / 2, 94, { align: 'center' });

        doc.setFontSize(32);
        doc.setTextColor(44, 62, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('TINA', pageWidth / 2, 35, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Teacher Identity Navigation Assistant', pageWidth / 2, 48, { align: 'center' });

        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text('Reflection Summary', pageWidth / 2, 125, { align: 'center' });

        doc.setFontSize(12);
        doc.setTextColor(127, 140, 141);
        doc.text('Coaching Debrief', pageWidth / 2, 138, { align: 'center' });

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

        const clusterKey = session.teacher_cluster as TeacherCluster;
        if (clusterKey && CLUSTER_INFO[clusterKey]) {
            const info = CLUSTER_INFO[clusterKey];
            doc.setFillColor(...info.colorRGB);
            doc.roundedRect(margin + 20, 205, pageWidth - margin * 2 - 40, 40, 5, 5, 'F');
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.text(info.shortLabel, pageWidth / 2, 220, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(info.title, pageWidth / 2, 232, { align: 'center' });

            doc.setTextColor(100, 100, 100);
            doc.setFontSize(9);
            const descLines = doc.splitTextToSize(info.description, maxWidth - 20);
            doc.text(descLines, pageWidth / 2, 255, { align: 'center' });
        }

        doc.setFontSize(8);
        doc.setTextColor(127, 140, 141);
        doc.text('Powered by TINA AI', pageWidth / 2, pageHeight - 20, { align: 'center' });

        doc.addPage();
        yPosition = 25;

        doc.setFillColor(244, 208, 63);
        doc.rect(0, 0, pageWidth, 15, 'F');
        doc.setFontSize(10);
        doc.setTextColor(44, 62, 80);
        doc.text('TINA Reflection Summary', pageWidth / 2, 10, { align: 'center' });
        yPosition = 30;

        const drawSectionTitle = (title: string) => {
            if (yPosition > 250) {
                doc.addPage();
                doc.setFillColor(244, 208, 63);
                doc.rect(0, 0, pageWidth, 15, 'F');
                doc.setFontSize(10);
                doc.setTextColor(44, 62, 80);
                doc.text('TINA Reflection Summary', pageWidth / 2, 10, { align: 'center' });
                yPosition = 30;
            }

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
                    doc.setFillColor(244, 208, 63);
                    doc.rect(0, 0, pageWidth, 15, 'F');
                    doc.setFontSize(10);
                    doc.setTextColor(44, 62, 80);
                    doc.text('TINA Reflection Summary', pageWidth / 2, 10, { align: 'center' });
                    yPosition = 30;
                    doc.setFontSize(10);
                }
                doc.text(line, margin + 5, yPosition);
                yPosition += 6;
            });
            yPosition += 8;
        };

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
    const clusterInfo = session.teacher_cluster ? CLUSTER_INFO[session.teacher_cluster as TeacherCluster] : null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button
                    className="modal-close"
                    onClick={onClose}
                    aria-label="Close reflection summary"
                >
                    ×
                </button>

                <div className="report-card">
                    <div className="report-tina-wrap">
                        <TinaAvatar state="celebrating" height={120} />
                    </div>
                    <div className="report-emblem" style={{
                        background: 'linear-gradient(135deg, #F4D03F 0%, #F39C12 100%)',
                        color: '#2C3E50',
                        fontSize: '2rem',
                        fontWeight: 'bold',
                        fontFamily: 'Georgia, serif',
                    }}>T</div>

                    <div className="report-header">
                        <h1>TINA Reflection Summary</h1>
                        <p>Teacher Identity Navigation Assistant</p>
                        <p className="report-date">Completed on {date}</p>
                    </div>

                    <div className="report-intro-note">
                        Use this as a coaching debrief. It is meant to help you notice what stood out and decide what to try next.
                    </div>

                    {jolApplicable && jolRating === null && (
                        <div className="report-jol-gate">
                            <h3>Before your summary, a quick check</h3>
                            <p className="report-trajectory-note">
                                How deeply do you feel you reflected today? There is no right answer, this is
                                just for you to notice.
                            </p>
                            <div className="jol-options">
                                {JOL_OPTIONS.map((opt) => (
                                    <button key={opt.band} className="jol-option" onClick={() => handleJolSelect(opt.band)}>
                                        <strong>{opt.label}</strong>
                                        <span>{opt.hint}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {reportRevealed && jol && (
                        <div className={`report-jol-card jol-gap-${Math.abs(jol.gap) <= 0 ? 'aligned' : jol.gap > 0 ? 'over' : 'under'}`}>
                            <h3>How that felt vs what it showed</h3>
                            <p className="report-trajectory-note">
                                You felt today was <strong>{BAND_LABEL[jol.selfRating]}</strong>, and your turns
                                showed <strong>{BAND_LABEL[jol.measuredBand]}</strong>.{' '}
                                {jol.gap === 0
                                    ? 'Your sense of your own reflection lined up well, that self-awareness is itself a strength.'
                                    : jol.gap > 0
                                        ? 'You felt a little deeper than the conversation showed, which is worth noticing, there may be more to put into words next time.'
                                        : 'You went deeper than you gave yourself credit for, do not undersell that.'}
                            </p>
                        </div>
                    )}

                    {reportRevealed && (
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
                    )}

                    {reportRevealed && trajectory.length >= 3 && (
                        <div className="report-trajectory">
                            <h3>Your Reflection Depth, Turn by Turn</h3>
                            <p className="report-trajectory-note">
                                Each bar is one of your messages: taller bars are moments where you
                                examined the "why" behind your teaching, not just the "what".
                            </p>
                            <div className="trajectory-bars" role="img" aria-label="Reflection depth per turn">
                                {trajectory.map((point) => (
                                    <div
                                        key={point.turnIndex}
                                        className={`trajectory-bar trajectory-${point.reflectionLevel}`}
                                        style={{ height: `${LEVEL_HEIGHT[point.reflectionLevel] * 22}px` }}
                                        title={`Turn ${point.turnIndex}: ${LEVEL_LABEL[point.reflectionLevel]}`}
                                    />
                                ))}
                            </div>
                            <div className="trajectory-legend">
                                <span><i className="trajectory-dot trajectory-technical" /> Brief</span>
                                <span><i className="trajectory-dot trajectory-descriptive" /> Describing</span>
                                <span><i className="trajectory-dot trajectory-critical" /> Examining why</span>
                            </div>
                        </div>
                    )}

                    {reportRevealed && carryQuestions.length > 0 && (
                        <div className="report-carry">
                            <h3>Carry One Question Forward</h3>
                            {carriedQuestion ? (
                                <p className="carry-saved">
                                    Saved. TINA will bring this back next time: <em>"{carriedQuestion}"</em>
                                </p>
                            ) : (
                                <>
                                    <p className="report-trajectory-note">
                                        Pick the question you most want to keep thinking about. TINA will
                                        return to it at the start of your next session.
                                    </p>
                                    <div className="carry-options">
                                        {carryQuestions.map((question, idx) => (
                                            <button
                                                key={idx}
                                                className="carry-option"
                                                onClick={() => handleCarrySelect(question)}
                                            >
                                                {question}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {reportRevealed && clusterInfo && (
                        <div className="report-lens-card">
                            <p className="report-lens-label">Optional reflection lens</p>
                            <h3 style={{ color: clusterInfo.color }}>{clusterInfo.title}</h3>
                            <p>{clusterInfo.description}</p>
                            <p className="report-lens-note">Use this as a light interpretive lens, not a grade or fixed label.</p>
                        </div>
                    )}

                    {reportRevealed && (
                        <div className="report-feedback-card">
                            {feedbackState === 'sent' ? (
                                <p className="carry-saved">Sent. Your instructor will leave feedback in My Account.</p>
                            ) : (
                                <>
                                    <h3>Want a second perspective?</h3>
                                    <p className="report-trajectory-note">
                                        Ask your instructor for written feedback on this reflection. It will appear in My Account.
                                    </p>
                                    <textarea
                                        className="feedback-note-input"
                                        placeholder="Optional: anything you'd like them to focus on?"
                                        value={feedbackNote}
                                        onChange={(e) => setFeedbackNote(e.target.value)}
                                        rows={2}
                                    />
                                    <button
                                        className="btn btn-secondary"
                                        disabled={feedbackState === 'sending'}
                                        onClick={async () => {
                                            setFeedbackState('sending');
                                            const ok = await requestInstructorFeedback({
                                                sessionId: session.id,
                                                userId: session.user_id,
                                                activityId: session.activity_id ?? null,
                                                note: feedbackNote,
                                            });
                                            setFeedbackState(ok ? 'sent' : 'idle');
                                        }}
                                    >
                                        {feedbackState === 'sending' ? 'Sending…' : 'Ask instructor for feedback'}
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="report-footer">
                        <p>Session ID: {session.id.slice(0, 8)}...</p>
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="btn btn-primary" onClick={downloadPDF}>
                        Download PDF
                    </button>
                    <button className="btn btn-secondary" onClick={onNewSession}>
                        Start Another Reflection
                    </button>
                </div>
            </div>
        </div>
    );
}
