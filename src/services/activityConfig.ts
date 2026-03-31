import type { ActivityConfig, ActivityGoal, LearnerLevel, OutputFormat } from '../types';

const STORAGE_KEY = 'tina.activityConfig';

const ACTIVITY_GOAL_LABELS: Record<ActivityGoal, string> = {
    reflection: 'Reflection',
    'case-analysis': 'Case Analysis',
    'lesson-design': 'Lesson Design',
    'ethics-decision': 'Ethics Decision',
    'feedback-revision': 'Feedback Revision',
};

const LEARNER_LEVEL_LABELS: Record<LearnerLevel, string> = {
    'intro-preservice': 'Intro Preservice Teacher',
    'mid-program': 'Mid-Program Preservice Teacher',
    'practicum-ready': 'Practicum Ready',
    graduate: 'Graduate Level',
};

const OUTPUT_FORMAT_LABELS: Record<OutputFormat, string> = {
    'short-reflection': 'Short Reflection',
    'three-point-action-plan': 'Three-Point Action Plan',
    'lesson-idea-draft': 'Lesson Idea Draft',
    'case-response-outline': 'Case Response Outline',
    checklist: 'Checklist',
};

export const defaultActivityConfig: ActivityConfig = {
    title: 'AI Reflection Studio',
    courseName: 'Preservice Teacher Development',
    moduleLabel: 'Current Activity',
    topic: 'AI Use in Teaching Practice',
    learnerDescription: 'Use TINA to reflect on your choices, compare options, and leave with a concise next step.',
    activityGoal: 'reflection',
    learnerLevel: 'mid-program',
    scenario: '',
    estimatedMinutes: 10,
    guidance: {
        evidenceFirst: true,
        compareAlternatives: true,
        learnerImpact: true,
        ethicsPrivacy: true,
        revisionBeforeWrapUp: true,
    },
    constraints: {
        noFullSubmissionDraftFirst: true,
        noOneClickAnswers: true,
        reasoningBeforeConclusion: true,
        conciseResponses: false,
    },
    outputFormat: 'short-reflection',
    instructorNote: '',
};

export function loadActivityConfig(): ActivityConfig {
    if (typeof window === 'undefined') {
        return defaultActivityConfig;
    }

    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return defaultActivityConfig;
        }

        const parsed = JSON.parse(raw);
        return {
            ...defaultActivityConfig,
            ...parsed,
            guidance: {
                ...defaultActivityConfig.guidance,
                ...(parsed.guidance || {}),
            },
            constraints: {
                ...defaultActivityConfig.constraints,
                ...(parsed.constraints || {}),
            },
        };
    } catch (error) {
        console.warn('Failed to load activity config:', error);
        return defaultActivityConfig;
    }
}

export function saveActivityConfig(config: ActivityConfig) {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('activity-config-updated', { detail: config }));
}

export function resetActivityConfig() {
    saveActivityConfig(defaultActivityConfig);
}

export function getActivityGoalLabel(goal: ActivityGoal) {
    return ACTIVITY_GOAL_LABELS[goal];
}

export function getLearnerLevelLabel(level: LearnerLevel) {
    return LEARNER_LEVEL_LABELS[level];
}

export function getOutputFormatLabel(format: OutputFormat) {
    return OUTPUT_FORMAT_LABELS[format];
}

export function buildActivitySystemInstruction(baseInstruction: string, config: ActivityConfig) {
    const guidanceRules = [
        config.guidance.evidenceFirst && 'Ask for evidence before drawing conclusions.',
        config.guidance.compareAlternatives && 'Encourage the learner to compare alternatives or tradeoffs.',
        config.guidance.learnerImpact && 'Prompt reflection on learner impact and classroom consequences.',
        config.guidance.ethicsPrivacy && 'Raise ethics, fairness, or privacy implications when relevant.',
        config.guidance.revisionBeforeWrapUp && 'Ask the learner to revise or refine before wrapping up.',
    ].filter(Boolean);

    const constraintRules = [
        config.constraints.noFullSubmissionDraftFirst && 'Do not produce a ready-to-submit answer on the first request.',
        config.constraints.noOneClickAnswers && 'Do not shortcut the activity with one-click answers.',
        config.constraints.reasoningBeforeConclusion && 'Require reasoning before final conclusions.',
        config.constraints.conciseResponses && 'Keep your responses concise and focused.',
    ].filter(Boolean);

    return `${baseInstruction}

9) Current Activity Context
- Activity title: ${config.title}
- Course: ${config.courseName}
- Module: ${config.moduleLabel}
- Topic: ${config.topic}
- Activity goal: ${getActivityGoalLabel(config.activityGoal)}
- Learner level: ${getLearnerLevelLabel(config.learnerLevel)}
- Learner-facing description: ${config.learnerDescription}
- Optional scenario: ${config.scenario || 'None provided'}
- Expected time: ${config.estimatedMinutes || 10} minutes
- Final output format: ${getOutputFormatLabel(config.outputFormat)}
- Instructor note: ${config.instructorNote || 'No additional note provided'}

10) Activity-Specific Guidance
${guidanceRules.length > 0 ? guidanceRules.map(rule => `- ${rule}`).join('\n') : '- Use the standard reflective flow.'}

11) Activity-Specific Constraints
${constraintRules.length > 0 ? constraintRules.map(rule => `- ${rule}`).join('\n') : '- Use the standard reflective flow.'}

12) Activity Alignment Rule
- Keep the same TINA identity and tone.
- Adapt your examples and closing summary to the activity context above.
- Shape the closing so the learner leaves with the configured final output format.
- Do not mention internal configuration or say that an instructor customized the bot.`;
}
