/* ============================================================================
   TINA — VALUES & TENSIONS CONSTELLATION (PURE, no DOM / no network)

   A learner-facing mirror for the closing report: the core values that
   surfaced this session, drawn as a small constellation around "you", with the
   belief-vs-practice / AI tension shown as the gap it pulls against. It reads
   the report TINA already wrote (no new data): the "Values Guiding You Right
   Now" section for the value stars, and the "Tensions or open questions" line
   for the tension. Pure parsing + geometry so it is unit-testable; the SVG
   component just renders what this returns. Empty/placeholder reports yield no
   stars, and the component hides itself.
   ========================================================================== */

import { parseReportSections } from './reflectionScoring.ts';

export interface ValueStar {
    name: string;
    note: string;
    /** position in the VIEW_W x VIEW_H space (see constants). */
    x: number;
    y: number;
    /** relative emphasis 0..1 (earlier-listed values read as more central). */
    weight: number;
}

export interface Constellation {
    values: ValueStar[];
    tension: string | null;
    center: { x: number; y: number };
}

// Render space the component maps into a responsive viewBox.
export const VIEW_W = 100;
export const VIEW_H = 70;
const CENTER = { x: VIEW_W / 2, y: VIEW_H / 2 };
const RADIUS_X = 34;
const RADIUS_Y = 24;
const MAX_VALUES = 6;

// Lines/markers we never want to treat as a real value (unfilled template,
// section scaffolding, or empty observations).
const PLACEHOLDER = /\[value name\]|\[brief|\bvalue name\b|^n\/?a$|^none$|^tbd$/i;

function clean(s: string): string {
    return (s || '')
        .replace(/\*\*/g, '')
        .replace(/^[\s\-*•]+/, '')
        .replace(/^\[|\]$/g, '')
        .trim();
}

/**
 * extractValues — PURE. Parse the "Values Guiding You Right Now" section into
 * {name, note} pairs. Tolerant of "- Name: note", "- **Name** — note", and
 * bare "- Name" lines; skips template placeholders and empty rows.
 */
export function extractValues(report: string | null | undefined): { name: string; note: string }[] {
    const section = parseReportSections(report).find((s) => /values?/i.test(s.title));
    if (!section) return [];
    const out: { name: string; note: string }[] = [];
    const seen = new Set<string>();
    for (const rawLine of section.content.split('\n')) {
        const line = rawLine.trim();
        if (!line || !/^[-*•]/.test(line)) continue;
        const body = clean(line);
        if (!body) continue;
        // split name from note on the first ":" or em/en dash separator
        const m = body.match(/^([^:–—-]{2,40})\s*[:–—-]\s*(.*)$/);
        const name = clean(m ? m[1] : body);
        const note = m ? m[2].trim() : '';
        if (!name || name.length < 2 || PLACEHOLDER.test(name)) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name, note });
        if (out.length >= MAX_VALUES) break;
    }
    return out;
}

/**
 * extractTension — PURE. Pull the "Tensions or open questions" line from the
 * "What Stood Out" section (falls back to any line in the report mentioning a
 * tension). Returns null when it is empty or a template placeholder.
 */
export function extractTension(report: string | null | undefined): string | null {
    const sections = parseReportSections(report);
    const stood = sections.find((s) => /stood out|what stood/i.test(s.title));
    const scan = (text: string): string | null => {
        for (const rawLine of text.split('\n')) {
            const line = rawLine.trim();
            const m = line.match(/tensions?[^:]*:\s*(.+)$/i);
            if (m) {
                const t = clean(m[1]);
                if (t && t.length > 4 && !PLACEHOLDER.test(t)) return t;
            }
        }
        return null;
    };
    if (stood) {
        const t = scan(stood.content);
        if (t) return t;
    }
    // fallback: any "belief ... practice" / "but" tension phrasing across sections
    for (const s of sections) {
        const t = scan(s.content);
        if (t) return t;
    }
    return null;
}

/**
 * buildConstellation — PURE. Lay the values out evenly around "you" (starting
 * at the top, clockwise), nearer the centre for earlier-listed values. Returns
 * positions in the VIEW_W x VIEW_H space plus the tension text.
 */
export function buildConstellation(report: string | null | undefined): Constellation {
    const values = extractValues(report);
    const n = values.length;
    const stars: ValueStar[] = values.map((v, i) => {
        // even angular spread, starting at top (-90deg), clockwise
        const angle = (-Math.PI / 2) + (i * (2 * Math.PI)) / Math.max(n, 1);
        // earlier values sit slightly closer in (more central to identity)
        const pull = 0.82 + (i / Math.max(n - 1, 1)) * 0.18;
        return {
            name: v.name,
            note: v.note,
            x: round(CENTER.x + Math.cos(angle) * RADIUS_X * pull),
            y: round(CENTER.y + Math.sin(angle) * RADIUS_Y * pull),
            weight: round(1 - i / Math.max(n, 1)),
        };
    });
    return { values: stars, tension: extractTension(report), center: { ...CENTER } };
}

function round(v: number): number {
    return Math.round(v * 100) / 100;
}
