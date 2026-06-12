import React from 'react';

/* ============================================================================
   InfoTip — a small "ⓘ" affordance that reveals an explanatory tooltip on
   hover OR keyboard focus. Used across the admin dashboard so each section
   says what it means and what data it holds. Accessible: focusable, the text
   is exposed via aria-label, and the bubble is aria-hidden decoration.
   ========================================================================== */

export function InfoTip({ text, label }: { text: string; label?: string }) {
    return (
        <span
            className="info-tip"
            tabIndex={0}
            role="note"
            aria-label={label ? `${label}. ${text}` : text}
        >
            <svg className="info-tip-icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
                <path
                    fill="currentColor"
                    d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM13 17h-2v-6h2z"
                />
            </svg>
            <span className="info-tip-bubble" role="tooltip" aria-hidden="true">{text}</span>
        </span>
    );
}
