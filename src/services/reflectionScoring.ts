/* ============================================================================
   TINA — reflection scoring (PURE, no DOM / no network)

   The report-grammar parsers + depth scoring + JOL calibration math. Kept free
   of the supabase/data import so it is unit-testable under `node --test` and
   reusable on both the report and the cross-session journey.
   ========================================================================== */

export interface ReportSection {
    title: string;
    content: string;
}

/** "**1) Title**content..." grammar, shared with ReportModal. */
export function parseReportSections(report: string | null | undefined): ReportSection[] {
    if (!report) return [];
    const sections: ReportSection[] = [];
    const regex = /\*\*(\d+\).*?)\*\*([\s\S]*?)(?=\*\*\d+\)|$)/g;
    let match;
    while ((match = regex.exec(report)) !== null) {
        sections.push({ title: match[1].trim(), content: match[2].trim() });
    }
    return sections;
}

export function extractNextMove(report: string | null | undefined): string | null {
    const section = parseReportSections(report).find((s) => s.title.toLowerCase().includes('next move'));
    if (!section) return null;
    const text = section.content.replace(/^\(|\)$/g, '').trim();
    if (text.length < 5) return null;
    return text.slice(0, 600);
}

export function extractCarryQuestions(report: string | null | undefined): string[] {
    const section = parseReportSections(report).find((s) => s.title.toLowerCase().includes('carry forward'));
    if (!section) return [];
    return section.content
        .split('\n')
        .map((line) => line.replace(/^\s*(?:Q\d+\s*[:.)-]?|[-*•])\s*/i, '').trim())
        .filter((line) => line.length > 10)
        .slice(0, 3);
}

// ---- depth scoring + JOL ----------------------------------------------------

export interface TrajectoryPoint {
    turnIndex: number;
    reflectionLevel: 'technical' | 'descriptive' | 'critical';
    move: string;
}

export type DepthBand = 1 | 2 | 3; // 1 brief, 2 describing, 3 examining-why

/** PURE. 0..1 weighted share of critical/descriptive turns. */
export function depthScore(points: TrajectoryPoint[]): number {
    if (!points.length) return 0;
    const weight = { technical: 0, descriptive: 0.5, critical: 1 } as const;
    const total = points.reduce((s, p) => s + weight[p.reflectionLevel], 0);
    return Math.round((total / points.length) * 100) / 100;
}

/** PURE. Map a 0..1 depth score to the 3 bands the learner self-rates on. */
export function depthBand(score: number): DepthBand {
    if (score >= 0.6) return 3;
    if (score >= 0.3) return 2;
    return 1;
}

export interface JolResult {
    selfRating: DepthBand;
    measuredBand: DepthBand;
    measuredScore: number;
    gap: number; // selfRating - measuredBand (+over / -under confident)
}

export function computeJol(selfRating: DepthBand, points: TrajectoryPoint[]): JolResult {
    const measuredScore = depthScore(points);
    const measuredBand = depthBand(measuredScore);
    return { selfRating, measuredBand, measuredScore, gap: selfRating - measuredBand };
}
