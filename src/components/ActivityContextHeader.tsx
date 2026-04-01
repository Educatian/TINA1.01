import React from 'react';
import type { ActivityConfig } from '../types';
import {
    getActivityGoalLabel,
    getLearnerLevelLabel,
    getOutputFormatLabel,
    getOutputPromise,
} from '../services/activityConfig';

interface ActivityContextHeaderProps {
    config: ActivityConfig;
    collapsed?: boolean;
    showToggle?: boolean;
    onToggle?: () => void;
}

export function ActivityContextHeader({
    config,
    collapsed = false,
    showToggle = false,
    onToggle,
}: ActivityContextHeaderProps) {
    const ruleChips = [
        config.guidance.evidenceFirst && 'Evidence first',
        config.guidance.compareAlternatives && 'Compare alternatives',
        config.guidance.learnerImpact && 'Learner impact',
        config.guidance.ethicsPrivacy && 'Ethics and privacy',
        config.constraints.noOneClickAnswers && 'No one-click answers',
        config.constraints.reasoningBeforeConclusion && 'Reasoning before conclusions',
    ].filter(Boolean) as string[];
    const visibleRuleChips = ruleChips.slice(0, 3);
    const hiddenRuleCount = Math.max(ruleChips.length - visibleRuleChips.length, 0);

    if (collapsed) {
        return (
            <div className="activity-context-card activity-context-card-collapsed">
                <div className="activity-context-collapsed-row">
                    <div>
                        <div className="activity-context-eyebrow">{getActivityGoalLabel(config.activityGoal)}</div>
                        <h2>{config.title}</h2>
                    </div>
                    <div className="activity-context-collapsed-meta">
                        <span>{config.estimatedMinutes || 10} min</span>
                        <span>{getOutputFormatLabel(config.outputFormat)}</span>
                        {showToggle && onToggle && (
                            <button
                                type="button"
                                className="activity-context-toggle"
                                onClick={onToggle}
                            >
                                Show details
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="activity-context-card">
            <div className="activity-context-top">
                <div className="activity-context-heading">
                    <div className="activity-context-title-row">
                        <div className="activity-context-eyebrow">{getActivityGoalLabel(config.activityGoal)}</div>
                        <h2>{config.title}</h2>
                    </div>
                    <p className="activity-context-description">{config.learnerDescription}</p>
                </div>
                <div className="activity-context-meta">
                    <span>{config.topic}</span>
                    {showToggle && onToggle && (
                        <button
                            type="button"
                            className="activity-context-toggle"
                            onClick={onToggle}
                        >
                            Minimize
                        </button>
                    )}
                </div>
            </div>

            <div className="activity-context-summary">
                <span><strong>Designed for</strong> {getLearnerLevelLabel(config.learnerLevel)}</span>
                <span><strong>Time</strong> {config.estimatedMinutes || 10} min</span>
                <span><strong>Output</strong> {getOutputFormatLabel(config.outputFormat)}</span>
            </div>

            <div className="activity-context-outcome">
                <strong>You will leave with:</strong> {getOutputPromise(config.outputFormat)}.
            </div>

            {ruleChips.length > 0 && (
                <div className="activity-rule-list">
                    {visibleRuleChips.map(rule => (
                        <span key={rule} className="activity-rule-chip">{rule}</span>
                    ))}
                    {hiddenRuleCount > 0 && (
                        <span className="activity-rule-chip activity-rule-chip-muted">+{hiddenRuleCount} more</span>
                    )}
                </div>
            )}

            {(config.scenario || config.instructorNote) && (
                <div className="activity-context-note">
                    {config.scenario && (
                        <p><strong>Scenario:</strong> {config.scenario}</p>
                    )}
                    {config.instructorNote && (
                        <p><strong>Instructor note:</strong> {config.instructorNote}</p>
                    )}
                </div>
            )}

            <div className="activity-context-footer">
                <p>The same TINA, framed for this learning activity.</p>
            </div>
        </div>
    );
}
