import React from 'react';

interface ProgressBarProps {
    currentTurn: number;
    totalTurns?: number;
}

function getProgressStage(currentTurn: number, totalTurns: number) {
    if (currentTurn <= 1) {
        return {
            label: 'Getting started',
            helper: 'TINA is setting up the reflection.',
        };
    }

    if (currentTurn <= Math.ceil(totalTurns * 0.4)) {
        return {
            label: 'Exploring your view',
            helper: 'You are clarifying your current thinking.',
        };
    }

    if (currentTurn <= Math.ceil(totalTurns * 0.75)) {
        return {
            label: 'Connecting to practice',
            helper: 'TINA is linking your ideas to real teaching choices.',
        };
    }

    return {
        label: 'Preparing your reflection',
        helper: 'Your summary and next step are coming together.',
    };
}

export function ProgressBar({ currentTurn, totalTurns = 12 }: ProgressBarProps) {
    const progress = Math.min((currentTurn / totalTurns) * 100, 100);
    const isNearEnd = currentTurn >= totalTurns - 2;
    const stage = getProgressStage(currentTurn, totalTurns);

    return (
        <div className="progress-container">
            <div className="progress-info">
                <span className="progress-label">{stage.label}</span>
                <span className="progress-count">{Math.min(currentTurn, totalTurns)} / {totalTurns}</span>
            </div>
            <div className="progress-bar-track">
                <div
                    className={`progress-bar-fill ${isNearEnd ? 'near-end' : ''}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="progress-hint">
                {isNearEnd ? 'Almost there. Your reflection summary is coming soon.' : stage.helper}
            </div>
        </div>
    );
}
