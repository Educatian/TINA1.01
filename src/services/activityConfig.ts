import { supabase } from '../lib/supabase';
import type {
    ActivityEnrollment,
    ActivityConfig,
    ActivityGoal,
    ActivityRecord,
    LearnerLevel,
    OutputFormat,
} from '../types';

const ACTIVE_ACTIVITY_ID_KEY = 'tina.activeActivityId';
const CACHED_ACTIVITY_CONFIG_KEY = 'tina.activityConfig.cache';

type ActivityRow = {
    id: string;
    instructor_id: string;
    title: string;
    course_name: string;
    module_label: string;
    topic: string;
    learner_description: string;
    activity_goal: ActivityGoal;
    learner_level: LearnerLevel;
    scenario: string | null;
    estimated_minutes: number | null;
    guidance: ActivityConfig['guidance'] | null;
    constraints: ActivityConfig['constraints'] | null;
    output_format: OutputFormat;
    instructor_note: string | null;
    is_published: boolean;
    created_at: string;
    updated_at: string;
};

type ActivityEnrollmentRow = {
    id: string;
    activity_id: string;
    learner_id: string;
    status: ActivityEnrollment['status'];
    created_at: string;
    activity?: ActivityRow | null;
};

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

function normalizeActivityConfig(config?: Partial<ActivityConfig> | null): ActivityConfig {
    return {
        ...defaultActivityConfig,
        ...config,
        guidance: {
            ...defaultActivityConfig.guidance,
            ...(config?.guidance || {}),
        },
        constraints: {
            ...defaultActivityConfig.constraints,
            ...(config?.constraints || {}),
        },
    };
}

function mapRowToActivityRecord(row: ActivityRow): ActivityRecord {
    const normalized = normalizeActivityConfig({
        title: row.title,
        courseName: row.course_name,
        moduleLabel: row.module_label,
        topic: row.topic,
        learnerDescription: row.learner_description,
        activityGoal: row.activity_goal,
        learnerLevel: row.learner_level,
        scenario: row.scenario || '',
        estimatedMinutes: row.estimated_minutes ?? defaultActivityConfig.estimatedMinutes,
        guidance: row.guidance || undefined,
        constraints: row.constraints || undefined,
        outputFormat: row.output_format,
        instructorNote: row.instructor_note || '',
    });

    return {
        id: row.id,
        instructorId: row.instructor_id,
        isPublished: row.is_published,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ...normalized,
    };
}

function mapConfigToRow(config: ActivityConfig) {
    const normalized = normalizeActivityConfig(config);
    return {
        title: normalized.title,
        course_name: normalized.courseName,
        module_label: normalized.moduleLabel,
        topic: normalized.topic,
        learner_description: normalized.learnerDescription,
        activity_goal: normalized.activityGoal,
        learner_level: normalized.learnerLevel,
        scenario: normalized.scenario || null,
        estimated_minutes: normalized.estimatedMinutes ?? 10,
        guidance: normalized.guidance,
        constraints: normalized.constraints,
        output_format: normalized.outputFormat,
        instructor_note: normalized.instructorNote || null,
    };
}

function dispatchActivityConfigUpdated(record: ActivityRecord | null) {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent('activity-config-updated', { detail: record }));
}

export function loadActivityConfig(): ActivityConfig {
    if (typeof window === 'undefined') {
        return defaultActivityConfig;
    }

    try {
        const raw = window.localStorage.getItem(CACHED_ACTIVITY_CONFIG_KEY);
        if (!raw) {
            return defaultActivityConfig;
        }

        return normalizeActivityConfig(JSON.parse(raw));
    } catch (error) {
        console.warn('Failed to load cached activity config:', error);
        return defaultActivityConfig;
    }
}

function cacheActivityRecord(record: ActivityRecord | null) {
    if (typeof window === 'undefined') {
        return;
    }

    if (!record) {
        window.localStorage.removeItem(CACHED_ACTIVITY_CONFIG_KEY);
        return;
    }

    window.localStorage.setItem(CACHED_ACTIVITY_CONFIG_KEY, JSON.stringify(normalizeActivityConfig(record)));
}

export function getActiveActivityId() {
    if (typeof window === 'undefined') {
        return null;
    }

    return window.localStorage.getItem(ACTIVE_ACTIVITY_ID_KEY);
}

export function setActiveActivityRecord(record: ActivityRecord | null) {
    if (typeof window === 'undefined') {
        return;
    }

    if (record) {
        window.localStorage.setItem(ACTIVE_ACTIVITY_ID_KEY, record.id);
        cacheActivityRecord(record);
    } else {
        window.localStorage.removeItem(ACTIVE_ACTIVITY_ID_KEY);
        cacheActivityRecord(null);
    }

    dispatchActivityConfigUpdated(record);
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

export async function listInstructorActivities(instructorId: string): Promise<ActivityRecord[]> {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('instructor_id', instructorId)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Failed to load instructor activities:', error);
        return [];
    }

    return ((data || []) as ActivityRow[]).map(mapRowToActivityRecord);
}

export async function listLearnerActivities(): Promise<ActivityRecord[]> {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('is_published', true)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Failed to load learner activities:', error);
        return [];
    }

    return ((data || []) as ActivityRow[]).map(mapRowToActivityRecord);
}

export async function listAssignedLearnerActivities(learnerId: string): Promise<ActivityRecord[]> {
    const { data, error } = await supabase
        .from('activity_enrollments')
        .select(`
            id,
            activity_id,
            learner_id,
            status,
            created_at,
            activity:activities(*)
        `)
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to load assigned learner activities:', error);
        return [];
    }

    return ((data || []) as ActivityEnrollmentRow[])
        .map((row) => row.activity ? mapRowToActivityRecord(row.activity) : null)
        .filter((record): record is ActivityRecord => Boolean(record));
}

export async function fetchActivityById(activityId: string): Promise<ActivityRecord | null> {
    const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('id', activityId)
        .maybeSingle();

    if (error) {
        console.error('Failed to fetch activity:', error);
        return null;
    }

    if (!data) {
        return null;
    }

    return mapRowToActivityRecord(data as ActivityRow);
}

export async function saveInstructorActivity(
    instructorId: string,
    config: ActivityConfig,
    activityId?: string | null,
): Promise<ActivityRecord | null> {
    const payload = {
        instructor_id: instructorId,
        ...mapConfigToRow(config),
    };

    const query = activityId
        ? supabase
            .from('activities')
            .update(payload)
            .eq('id', activityId)
        : supabase
            .from('activities')
            .insert(payload);

    const { data, error } = await query
        .select('*')
        .single();

    if (error) {
        console.error('Failed to save activity:', error);
        throw error;
    }

    const record = mapRowToActivityRecord(data as ActivityRow);
    setActiveActivityRecord(record);
    return record;
}

export async function deleteInstructorActivity(activityId: string) {
    const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', activityId);

    if (error) {
        console.error('Failed to delete activity:', error);
        throw error;
    }

    if (getActiveActivityId() === activityId) {
        setActiveActivityRecord(null);
    }
}

export async function listActivityEnrollments(activityId: string): Promise<ActivityEnrollment[]> {
    const { data, error } = await supabase
        .from('activity_enrollments')
        .select('*')
        .eq('activity_id', activityId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Failed to load activity enrollments:', error);
        return [];
    }

    return ((data || []) as ActivityEnrollmentRow[]).map((row) => ({
        id: row.id,
        activityId: row.activity_id,
        learnerId: row.learner_id,
        status: row.status,
        createdAt: row.created_at,
    }));
}

export async function assignLearnerToActivity(activityId: string, learnerId: string) {
    const { data, error } = await supabase
        .from('activity_enrollments')
        .upsert({
            activity_id: activityId,
            learner_id: learnerId,
            status: 'assigned',
        }, { onConflict: 'activity_id,learner_id' })
        .select('*')
        .single();

    if (error) {
        console.error('Failed to assign learner to activity:', error);
        throw error;
    }

    const row = data as ActivityEnrollmentRow;
    return {
        id: row.id,
        activityId: row.activity_id,
        learnerId: row.learner_id,
        status: row.status,
        createdAt: row.created_at,
    } satisfies ActivityEnrollment;
}

export async function removeLearnerFromActivity(activityId: string, learnerId: string) {
    const { error } = await supabase
        .from('activity_enrollments')
        .delete()
        .eq('activity_id', activityId)
        .eq('learner_id', learnerId);

    if (error) {
        console.error('Failed to remove learner from activity:', error);
        throw error;
    }
}

export async function updateEnrollmentStatus(
    activityId: string,
    learnerId: string,
    status: ActivityEnrollment['status'],
) {
    const { error } = await supabase
        .from('activity_enrollments')
        .update({ status })
        .eq('activity_id', activityId)
        .eq('learner_id', learnerId);

    if (error) {
        console.error('Failed to update enrollment status:', error);
        throw error;
    }
}

export async function setActivityPublished(activityId: string, isPublished: boolean) {
    const { data, error } = await supabase
        .from('activities')
        .update({ is_published: isPublished })
        .eq('id', activityId)
        .select('*')
        .single();

    if (error) {
        console.error('Failed to update publish status:', error);
        throw error;
    }

    const record = mapRowToActivityRecord(data as ActivityRow);
    if (getActiveActivityId() === activityId) {
        setActiveActivityRecord(record);
    }

    return record;
}

export async function resolveActivityForChat(options: {
    userId: string;
    isInstructor: boolean;
    preferredActivityId?: string | null;
}): Promise<ActivityRecord | null> {
    const explicitId = options.preferredActivityId || getActiveActivityId();
    if (explicitId) {
        const explicitRecord = await fetchActivityById(explicitId);
        if (explicitRecord) {
            if (options.isInstructor) {
                setActiveActivityRecord(explicitRecord);
            } else {
                cacheActivityRecord(explicitRecord);
            }
            return explicitRecord;
        }
    }

    const records = options.isInstructor
        ? await listInstructorActivities(options.userId)
        : await listAssignedLearnerActivities(options.userId);

    const firstRecord = records[0] || null;
    if (firstRecord) {
        if (options.isInstructor) {
            setActiveActivityRecord(firstRecord);
        } else {
            cacheActivityRecord(firstRecord);
        }
    }

    return firstRecord;
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
