import React, { useEffect, useMemo, useState } from 'react';
import type { ActivityConfig, ActivityGoal, LearnerLevel, OutputFormat } from '../types';
import {
    defaultActivityConfig,
    getActivityGoalLabel,
    getLearnerLevelLabel,
    getOutputFormatLabel,
} from '../services/activityConfig';

interface ActivityConfigFormProps {
    initialConfig: ActivityConfig;
    onSave: (config: ActivityConfig) => Promise<void> | void;
    saveLabel?: string;
}

const activityGoals: ActivityGoal[] = [
    'reflection',
    'case-analysis',
    'lesson-design',
    'ethics-decision',
    'feedback-revision',
];

const learnerLevels: LearnerLevel[] = [
    'intro-preservice',
    'mid-program',
    'practicum-ready',
    'graduate',
];

const outputFormats: OutputFormat[] = [
    'short-reflection',
    'three-point-action-plan',
    'lesson-idea-draft',
    'case-response-outline',
    'checklist',
];

export function ActivityConfigForm({ initialConfig, onSave, saveLabel = 'Save Activity' }: ActivityConfigFormProps) {
    const [config, setConfig] = useState<ActivityConfig>(initialConfig);
    const [saveMessage, setSaveMessage] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setConfig(initialConfig);
        setSaveMessage('');
    }, [initialConfig]);

    const guidanceSummary = useMemo(
        () => [
            config.guidance.evidenceFirst && 'evidence-first prompts',
            config.guidance.compareAlternatives && 'alternative comparison',
            config.guidance.learnerImpact && 'learner-impact reflection',
            config.guidance.ethicsPrivacy && 'ethics and privacy checks',
            config.guidance.revisionBeforeWrapUp && 'revision before wrap-up',
        ].filter(Boolean).join(', '),
        [config.guidance],
    );

    const updateConfig = <K extends keyof ActivityConfig>(key: K, value: ActivityConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaveMessage('');
    };

    const updateGuidance = (key: keyof ActivityConfig['guidance']) => {
        setConfig(prev => ({
            ...prev,
            guidance: {
                ...prev.guidance,
                [key]: !prev.guidance[key],
            },
        }));
        setSaveMessage('');
    };

    const updateConstraint = (key: keyof ActivityConfig['constraints']) => {
        setConfig(prev => ({
            ...prev,
            constraints: {
                ...prev.constraints,
                [key]: !prev.constraints[key],
            },
        }));
        setSaveMessage('');
    };

    const handleSave = async () => {
        setIsSaving(true);
        setSaveMessage('');

        try {
            await onSave(config);
            setSaveMessage('Saved. New chat sessions will use this activity setup.');
        } catch (error) {
            console.error('Failed to save activity:', error);
            setSaveMessage('Could not save this activity. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(defaultActivityConfig);
        setSaveMessage('Reset the form to the default activity template. Save to apply it.');
    };

    return (
        <div className="activity-admin-layout">
            <div className="activity-admin-main">
                <div className="activity-form-section">
                    <h2>Shared Activity Setup</h2>
                    <p>Instructors can tune the learning activity around TINA without changing the chatbot itself.</p>
                </div>

                <div className="activity-form-section">
                    <h3>Basic Information</h3>
                    <div className="activity-form-grid">
                        <label className="activity-field">
                            <span>Activity Title</span>
                            <input
                                type="text"
                                value={config.title}
                                onChange={(e) => updateConfig('title', e.target.value)}
                            />
                        </label>
                        <label className="activity-field">
                            <span>Course</span>
                            <input
                                type="text"
                                value={config.courseName}
                                onChange={(e) => updateConfig('courseName', e.target.value)}
                            />
                        </label>
                        <label className="activity-field">
                            <span>Module</span>
                            <input
                                type="text"
                                value={config.moduleLabel}
                                onChange={(e) => updateConfig('moduleLabel', e.target.value)}
                            />
                        </label>
                        <label className="activity-field">
                            <span>Topic</span>
                            <input
                                type="text"
                                value={config.topic}
                                onChange={(e) => updateConfig('topic', e.target.value)}
                            />
                        </label>
                    </div>

                    <label className="activity-field">
                        <span>Learner Description</span>
                        <textarea
                            rows={3}
                            value={config.learnerDescription}
                            onChange={(e) => updateConfig('learnerDescription', e.target.value)}
                        />
                    </label>
                </div>

                <div className="activity-form-section">
                    <h3>Conversation Setup</h3>
                    <div className="activity-form-grid">
                        <label className="activity-field">
                            <span>Activity Goal</span>
                            <select
                                value={config.activityGoal}
                                onChange={(e) => updateConfig('activityGoal', e.target.value as ActivityGoal)}
                            >
                                {activityGoals.map(goal => (
                                    <option key={goal} value={goal}>{getActivityGoalLabel(goal)}</option>
                                ))}
                            </select>
                        </label>

                        <label className="activity-field">
                            <span>Learner Level</span>
                            <select
                                value={config.learnerLevel}
                                onChange={(e) => updateConfig('learnerLevel', e.target.value as LearnerLevel)}
                            >
                                {learnerLevels.map(level => (
                                    <option key={level} value={level}>{getLearnerLevelLabel(level)}</option>
                                ))}
                            </select>
                        </label>

                        <label className="activity-field">
                            <span>Expected Minutes</span>
                            <input
                                type="number"
                                min={5}
                                max={30}
                                value={config.estimatedMinutes || 10}
                                onChange={(e) => updateConfig('estimatedMinutes', Number(e.target.value))}
                            />
                        </label>

                        <label className="activity-field">
                            <span>Final Output</span>
                            <select
                                value={config.outputFormat}
                                onChange={(e) => updateConfig('outputFormat', e.target.value as OutputFormat)}
                            >
                                {outputFormats.map(format => (
                                    <option key={format} value={format}>{getOutputFormatLabel(format)}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="activity-field">
                        <span>Scenario or Case</span>
                        <textarea
                            rows={3}
                            value={config.scenario || ''}
                            onChange={(e) => updateConfig('scenario', e.target.value)}
                        />
                    </label>

                    <label className="activity-field">
                        <span>Instructor Note</span>
                        <textarea
                            rows={2}
                            value={config.instructorNote || ''}
                            onChange={(e) => updateConfig('instructorNote', e.target.value)}
                        />
                    </label>
                </div>

                <div className="activity-form-section">
                    <h3>Guidance Rules</h3>
                    <div className="activity-toggle-list">
                        <label><input type="checkbox" checked={config.guidance.evidenceFirst} onChange={() => updateGuidance('evidenceFirst')} /> Ask for evidence before conclusions</label>
                        <label><input type="checkbox" checked={config.guidance.compareAlternatives} onChange={() => updateGuidance('compareAlternatives')} /> Ask learners to compare alternatives</label>
                        <label><input type="checkbox" checked={config.guidance.learnerImpact} onChange={() => updateGuidance('learnerImpact')} /> Prompt learner-impact reflection</label>
                        <label><input type="checkbox" checked={config.guidance.ethicsPrivacy} onChange={() => updateGuidance('ethicsPrivacy')} /> Surface ethics and privacy issues</label>
                        <label><input type="checkbox" checked={config.guidance.revisionBeforeWrapUp} onChange={() => updateGuidance('revisionBeforeWrapUp')} /> Require revision before wrap-up</label>
                    </div>
                </div>

                <div className="activity-form-section">
                    <h3>Constraints</h3>
                    <div className="activity-toggle-list">
                        <label><input type="checkbox" checked={config.constraints.noFullSubmissionDraftFirst} onChange={() => updateConstraint('noFullSubmissionDraftFirst')} /> Do not draft a full submission immediately</label>
                        <label><input type="checkbox" checked={config.constraints.noOneClickAnswers} onChange={() => updateConstraint('noOneClickAnswers')} /> Block one-click answers</label>
                        <label><input type="checkbox" checked={config.constraints.reasoningBeforeConclusion} onChange={() => updateConstraint('reasoningBeforeConclusion')} /> Require reasoning before conclusions</label>
                        <label><input type="checkbox" checked={config.constraints.conciseResponses} onChange={() => updateConstraint('conciseResponses')} /> Keep responses concise</label>
                    </div>
                </div>

                <div className="activity-form-actions">
                    <button className="btn btn-secondary" onClick={handleReset}>Reset Defaults</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : saveLabel}
                    </button>
                </div>

                {saveMessage && <p className="activity-save-message">{saveMessage}</p>}
            </div>

            <div className="activity-admin-sidebar">
                <div className="activity-preview-card">
                    <div className="activity-context-eyebrow">Learner Preview</div>
                    <h3>{config.title}</h3>
                    <p>{config.learnerDescription}</p>
                    <div className="activity-preview-meta">
                        <span>{config.courseName}</span>
                        <span>{config.moduleLabel}</span>
                        <span>{getLearnerLevelLabel(config.learnerLevel)}</span>
                    </div>
                    <div className="activity-preview-output">
                        <strong>Final output</strong>
                        <p>{getOutputFormatLabel(config.outputFormat)}</p>
                    </div>
                    <div className="activity-preview-output">
                        <strong>Guidance emphasis</strong>
                        <p>{guidanceSummary || 'Standard reflective flow'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
