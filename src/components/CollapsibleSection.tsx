import React, { useState } from 'react';

/* ============================================================================
   CollapsibleSection — an account-page panel that can fold to a single header
   row. Keeps the My Account page short: analytics panels default closed, the
   open/closed choice persists per panel in localStorage.
   ========================================================================== */

interface Props {
    storageKey: string;
    title: string;
    /** Short one-line summary shown in the header while the panel is closed. */
    summary?: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({ storageKey, title, summary, defaultOpen = true, children }: Props) {
    const lsKey = `tina-account-sec-${storageKey}`;
    const [open, setOpen] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem(lsKey);
            if (saved !== null) return saved === '1';
        } catch { /* storage unavailable: fall through to default */ }
        return defaultOpen;
    });

    const toggle = () => {
        setOpen((prev) => {
            try { localStorage.setItem(lsKey, prev ? '0' : '1'); } catch { /* ignore */ }
            return !prev;
        });
    };

    return (
        <div className="account-section collapsible-section">
            <h2 className="collapse-h2">
                <button type="button" className="collapse-header" aria-expanded={open} onClick={toggle}>
                    <span className="collapse-title">{title}</span>
                    {summary && !open && <span className="collapse-summary">{summary}</span>}
                    <span className={`collapse-chevron ${open ? 'is-open' : ''}`} aria-hidden="true">▾</span>
                </button>
            </h2>
            {open && <div className="collapse-body">{children}</div>}
        </div>
    );
}
