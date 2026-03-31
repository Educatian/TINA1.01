# TINA Experience Customization Spec

## Goal

TINA keeps one chatbot identity and one core conversation style.
The product does not support instructor-specific bot personas or free-form prompt engineering.
Instead, instructors customize the learning activity context that wraps the same chatbot.

This keeps the learner experience stable while letting instructors align the conversation to a course, week, assignment, or reflection goal.

## Experience Model

### Shared chatbot

- Same bot name: `TINA`
- Same base tone: reflective, supportive, question-led
- Same base interaction pattern: clarify context, probe reasoning, encourage evidence, end with a concise synthesis
- Same base safeguards: no hidden role switching, no unrestricted answer-writing mode, no instructor-authored system prompt editing

### Instructor role

Instructor uses the app to:

- create or edit a learning activity
- define the context learners see before chat starts
- tune a small set of structured options
- monitor participation and outcomes

Instructor does not:

- create a separate chatbot
- directly alter TINA's core persona
- write unrestricted system instructions

### Learner role

Learner uses the app to:

- open an assigned activity
- understand the task, rules, and expected outcome
- chat with the same TINA used across the product
- submit or save the final result

## Allowed Customization

Only structured customization is allowed.

### 1. Activity goal

Defines the main purpose of the conversation.

Allowed values:

- `reflection`
- `case-analysis`
- `lesson-design`
- `ethics-decision`
- `feedback-revision`

Effect on TINA:

- changes question emphasis
- changes closing summary format
- does not change TINA's identity

### 2. Learner level

Defines depth and complexity.

Allowed values:

- `intro preservice teacher`
- `mid-program preservice teacher`
- `practicum-ready`
- `graduate level`

Effect on TINA:

- adjusts wording complexity
- adjusts number of scaffolding prompts
- adjusts how much ambiguity TINA allows before offering structure

### 3. Course context

Defines the instructional frame.

Fields:

- `course name`
- `week or module`
- `topic`
- `assignment or activity title`
- `optional scenario`

Effect on TINA:

- references the current course situation
- keeps the conversation anchored to the intended task

### 4. Guidance rules

Defines what TINA should emphasize during the conversation.

Allowed toggles:

- `ask for evidence before conclusions`
- `require comparison of alternatives`
- `ask for learner-impact reflection`
- `ask for ethics/privacy consideration`
- `encourage revision before final answer`

Effect on TINA:

- inserts additional prompts or reminders
- affects the synthesis checklist

### 5. Constraint rules

Defines what TINA should not do for this activity.

Allowed toggles:

- `do not write the full answer for the learner`
- `do not produce ready-to-submit text on first request`
- `do not skip citation or source-check reminders`
- `do not give a single best answer without tradeoffs`

Effect on TINA:

- blocks shortcut behaviors
- keeps the experience aligned with instructional intent

### 6. Final output format

Defines what the learner leaves with.

Allowed values:

- `short reflection`
- `three-point action plan`
- `lesson idea draft`
- `case response outline`
- `checklist`

Effect on TINA:

- shapes the final turn and saved report

## Customization UI For Instructors

The instructor setup flow should be framed as `Create Activity`, not `Customize Bot`.

### Section 1. Basic activity info

- `Activity title`
- `Course`
- `Week / Module`
- `Topic`
- `Short learner-facing description`

### Section 2. Conversation setup

- `Activity goal`
- `Learner level`
- `Optional scenario or case`
- `Estimated time`

### Section 3. Guidance options

- `Ask for evidence`
- `Ask for alternatives`
- `Ask for learner impact`
- `Ask for ethics/privacy`
- `Prompt revision before wrap-up`

### Section 4. Constraints

- `Do not draft final submission immediately`
- `Do not provide one-click answers`
- `Require reasoning before conclusions`
- `Keep responses concise`

### Section 5. Final output

- `Output format`
- `What learners should submit or save`
- `Optional instructor note for final reflection`

### Section 6. Preview

Preview should show:

- learner header
- active rules
- final output label
- one example opening message from TINA

## Learner Chat Header Information Architecture

The learner should always see the same TINA chat shell.
Only the contextual header above the conversation changes.

### Header block order

1. `Activity title`
2. `One-line purpose`
3. `Course / module metadata`
4. `What TINA will help you do`
5. `Ground rules`
6. `Expected final output`

### Recommended header content

#### Top row

- `Activity title`
- `Course name`
- `Week / Module`

#### Purpose strip

Single sentence:

`In this activity, TINA will help you reflect, compare options, and prepare a concise outcome for this week's task.`

#### Rules strip

Short chips or labels:

- `Evidence first`
- `Compare alternatives`
- `No ready-made submission`
- `Reflect on learner impact`

#### Output strip

Short sentence:

`You will leave with: a three-point action plan`

#### Optional disclosure

Short persistent note:

`TINA supports reflection and drafting. You are still responsible for judgment, verification, and final submission decisions.`

## Opening Flow For Learners

Before the first chat turn, show:

1. activity header
2. one short TINA greeting anchored to the activity
3. optional starter prompts

Example starter prompts:

- `Help me think through this case`
- `Ask me questions before giving suggestions`
- `Help me compare two lesson approaches`

## Prompt Assembly Rules

Internally, prompt construction should follow this order:

1. base TINA identity
2. safety and policy rules
3. activity goal
4. learner level
5. course context
6. guidance toggles
7. constraint toggles
8. final output format

This order prevents instructor settings from overriding core identity and safety rules.

## Data Model Recommendation

Add a structured activity configuration object instead of storing raw prompt text.

```ts
type ActivityConfig = {
  title: string;
  courseName: string;
  moduleLabel: string;
  topic: string;
  learnerDescription: string;
  activityGoal:
    | 'reflection'
    | 'case-analysis'
    | 'lesson-design'
    | 'ethics-decision'
    | 'feedback-revision';
  learnerLevel:
    | 'intro-preservice'
    | 'mid-program'
    | 'practicum-ready'
    | 'graduate';
  scenario?: string;
  estimatedMinutes?: number;
  guidance: {
    evidenceFirst: boolean;
    compareAlternatives: boolean;
    learnerImpact: boolean;
    ethicsPrivacy: boolean;
    revisionBeforeWrapUp: boolean;
  };
  constraints: {
    noFullSubmissionDraftFirst: boolean;
    noOneClickAnswers: boolean;
    reasoningBeforeConclusion: boolean;
    conciseResponses: boolean;
  };
  outputFormat:
    | 'short-reflection'
    | 'three-point-action-plan'
    | 'lesson-idea-draft'
    | 'case-response-outline'
    | 'checklist';
  instructorNote?: string;
};
```

## Guardrails

The instructor customization screen should not expose:

- free text system prompt editing
- tone selector for different bot personalities
- hidden policy overrides
- direct answer-writing mode
- grading or automated judgment language as the default experience

## Analytics Recommendation

Track customization usage as activity metadata, not as bot variants.

Recommended fields:

- `activity_goal`
- `learner_level`
- `guidance_flags`
- `constraint_flags`
- `output_format`
- `completion_rate`
- `average_turns`
- `follow_up_submission_rate`

## Implementation Priority

### Phase 1

- add `ActivityConfig` model
- add instructor `Create Activity` form
- add learner header block above chat
- connect header values to prompt assembly

### Phase 2

- add preview mode for instructors
- add saved activity templates
- add activity-level analytics filtering

### Phase 3

- add course-level content library
- add follow-up activity chaining
- add comparison reporting across activity goals
