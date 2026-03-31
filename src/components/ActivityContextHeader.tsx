import React from 'react';
import type { ActivityConfig } from '../types';
import {
    getActivityGoalLabel,
    getLearnerLevelLabel,
    getOutputFormatLabel,
} from '../services/activityConfig';

interface ActivityContextHeaderProps {
    config: ActivityConfig;
}

export function ActivityContextHeader({ config }: ActivityContextHeaderProps) {
    const ruleChips = [
        config.guidance.evidenceFirst && 'Evidence first',
        config.guidance.compareAlternatives && 'Compare alternatives',
        config.guidance.learnerImpact && 'Learner impact',
        config.guidance.ethicsPrivacy && 'Ethics and privacy',
        config.constraints.noOneClickAnswers && 'No one-click answers',
        config.constraints.reasoningBeforeConclusion && 'Reasoning before conclusions',
    ].filter(Boolean) as string[];

    return (
        <div className="activity-context-card">
            <div className="activity-context-top">
                <div>
                    <div className="activity-context-eyebrow">{getActivityGoalLabel(config.activityGoal)}</div>
                    <h2>{config.title}</h2>
                </div>
                <div className="activity-context-meta">
                    <span>{config.courseName}</span>
                    <span>{config.moduleLabel}</span>
                </div>
            </div>

            <p className="activity-context-description">{config.learnerDescription}</p>

            <div className="activity-context-grid">
                <div className="activity-context-panel">
                    <strong>Topic</strong>
                    <p>{config.topic}</p>
                </div>
                <div className="activity-context-panel">
                    <strong>Learner Level</strong>
                    <p>{getLearnerLevelLabel(config.learnerLevel)}</p>
                </div>
                <div className="activity-context-panel">
                    <strong>Expected Time</strong>
                    <p>{config.estimatedMinutes || 10} minutes</p>
                </div>
                <div className="activity-context-panel">
                    <strong>Final Output</strong>
                    <p>{getOutputFormatLabel(config.outputFormat)}</p>
                </div>
            </div>

            {config.scenario && (
                <div className="activity-context-callout">
                    <strong>Scenario</strong>
                    <p>{config.scenario}</p>
                </div>
            )}

            {ruleChips.length > 0 && (
                <div className="activity-rule-list">
                    {ruleChips.map(rule => (
                        <span key={rule} className="activity-rule-chip">{rule}</span>
                    ))}
                </div>
            )}

            <div className="activity-context-footer">
                <p>You are chatting with the same TINA. This activity only changes the learning context, not the chatbot identity.</p>
                {config.instructorNote && (
                    <p><strong>Instructor note:</strong> {config.instructorNote}</p>
                )}
            </div>
        </div>
    );
}
