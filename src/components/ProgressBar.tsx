import React from 'react';

interface ProgressBarProps {
    currentTurn: number;
    totalTurns?: number;
}

export function ProgressBar({ currentTurn, totalTurns = 12 }: ProgressBarProps) {
    const progress = Math.min((currentTurn / totalTurns) * 100, 100);
    const isNearEnd = currentTurn >= totalTurns - 2;

    return (
        <div className="progress-container">
            <div className="progress-info">
                <span className="progress-label">Session Progress</span>
                <span className="progress-count">Turn {currentTurn}</span>
            </div>
            <div className="progress-bar-track">
                <div
                    className={`progress-bar-fill ${isNearEnd ? 'near-end' : ''}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            {isNearEnd && (
                <div className="progress-hint">
                    ✨ Almost there! Your reflection report is coming soon.
                </div>
            )}
        </div>
    );
}
