import React from 'react';

/* ============================================================================
   MarkdownLite — dependency-free, injection-safe rendering of the small
   markdown subset Gemini actually emits in chat (**bold**, *italic*,
   bullet/numbered lists, paragraphs). Builds React elements directly — no
   innerHTML, so there is nothing to sanitize.
   ========================================================================== */

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    // Split on **bold** first, then *italic* inside the remainder.
    const nodes: React.ReactNode[] = [];
    const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
    boldParts.forEach((part, i) => {
        if (/^\*\*[^*]+\*\*$/.test(part)) {
            nodes.push(<strong key={`${keyPrefix}-b${i}`}>{part.slice(2, -2)}</strong>);
            return;
        }
        const italicParts = part.split(/(\*[^*]+\*)/g);
        italicParts.forEach((ip, j) => {
            if (/^\*[^*]+\*$/.test(ip)) {
                nodes.push(<em key={`${keyPrefix}-i${i}-${j}`}>{ip.slice(1, -1)}</em>);
            } else if (ip) {
                nodes.push(<React.Fragment key={`${keyPrefix}-t${i}-${j}`}>{ip}</React.Fragment>);
            }
        });
    });
    return nodes;
}

export function MarkdownLite({ text }: { text: string }) {
    const lines = (text || '').split('\n');
    const blocks: React.ReactNode[] = [];
    let listItems: { ordered: boolean; content: string }[] = [];

    const flushList = (key: string) => {
        if (listItems.length === 0) return;
        const ordered = listItems[0].ordered;
        const items = listItems.map((item, i) => (
            <li key={`${key}-li${i}`}>{renderInline(item.content, `${key}-li${i}`)}</li>
        ));
        blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
        listItems = [];
    };

    lines.forEach((line, idx) => {
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        if (bullet) {
            listItems.push({ ordered: false, content: bullet[1] });
            return;
        }
        if (numbered) {
            listItems.push({ ordered: true, content: numbered[1] });
            return;
        }
        flushList(`list-${idx}`);
        if (line.trim()) {
            blocks.push(<p key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</p>);
        }
    });
    flushList('list-end');

    return <div className="markdown-lite">{blocks}</div>;
}
