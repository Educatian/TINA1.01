# Instructor And Student Playtest

## Scope
- Product: TINA web app
- Perspectives tested: instructor and student
- Method: heuristic playtest walkthrough based on current local app flow, role-specific UI, and component-level inspection
- Goal: identify the most important UX and product gaps for classroom-style operation

## Summary
- TINA is becoming more coherent as a shared chatbot with configurable learning context.
- The student side is now easier to enter and better framed than before, but still needs stronger task clarity and less evaluative language.
- The instructor side is functionally richer, but the workflow still feels like a power-user dashboard rather than a course management flow.
- The biggest cross-role gap is handoff: instructors configure activities, but the learner journey does not yet feel clearly launched, assigned, and reviewed as one connected experience.

## Persona A: Instructor Playtest

### Persona
- Name: Professor Lee
- Role: instructor teaching preservice teachers
- Goal: create an activity, assign it, monitor completion, and review outputs
- Constraint: wants to move quickly and understand what learners are seeing without reading system details

### Walkthrough
1. Log in as instructor.
2. Open dashboard.
3. Create or select an activity.
4. Publish and assign it.
5. Check learner progress and outputs.
6. Try to understand whether the activity worked.

### Instructor Findings

#### 1. Activity lifecycle is not obvious enough
- Severity: High
- Problem:
  - instructors must infer the difference between `selected`, `active instructor chat context`, `published`, and `assigned`
  - these are all valid system states, but the product does not explain them as a simple flow
- Why it matters:
  - course staff want to think in terms of `draft -> publish -> assign -> monitor`, not database-like state labels
- Improvement:
  - add a visible lifecycle bar or checklist:
    - `Drafted`
    - `Published`
    - `Assigned`
    - `Started`
    - `Completed`

#### 2. Dashboard is strong for setup, weak for instructional decision-making
- Severity: High
- Problem:
  - activity setup and assignment are present
  - but the dashboard does not quickly answer:
    - who has not started?
    - who is stuck?
    - which activity wording led to weak outputs?
- Why it matters:
  - instructors need actionable signals, not only totals
- Improvement:
  - add learner-level status views:
    - not started
    - in progress
    - completed
    - submitted
  - add lightweight risk flags such as:
    - very short sessions
    - abandoned sessions
    - no output submitted

#### 3. Learner assignment UI is technically workable but too noisy
- Severity: Medium
- Problem:
  - assignment list currently shows all users in one long flat list
  - no search, grouping, or class-level organization
- Why it matters:
  - this will not scale once a course has many learners or multiple sections
- Improvement:
  - add search and filtering
  - later add section or course grouping
  - move preview-test accounts into a separate secondary area

#### 4. Instructor cannot easily see the learner-facing version before launch
- Severity: Medium
- Problem:
  - learner preview mode exists, but it still behaves like a testing utility
  - it is not framed as `preview what learners will experience`
- Why it matters:
  - instructors need confidence before publishing
- Improvement:
  - add a `Preview learner experience` button inside the activity workflow
  - open the learner view with the exact selected activity context

#### 5. Analytics are still session-centric more than teaching-centric
- Severity: Medium
- Problem:
  - the dashboard has activity metrics and NLP analytics
  - but the synthesis is still closer to raw system reporting than instructional reflection
- Why it matters:
  - instructors want to know whether the activity design succeeded pedagogically
- Improvement:
  - shift toward:
    - completion rate by activity
    - average reflection depth
    - common learner concerns
    - common next-step themes
    - weak prompt points

#### 6. Copy still sounds more like platform administration than teaching support
- Severity: Medium
- Problem:
  - labels such as `Shared Activity Setup` and internal state language feel system-first
- Improvement:
  - simplify around course tasks:
    - `Create Activity`
    - `Assign Learners`
    - `Review Progress`
    - `Review Reflections`

### Instructor What Works
- Activity configuration is now meaningfully structured.
- Assignment and output review are connected in one place.
- Activity-based analysis is a solid foundation for real course usage.

## Persona B: Student Playtest

### Persona
- Name: Mina
- Role: mid-program preservice teacher
- Goal: complete a guided reflection activity and leave with a usable next step
- Constraint: low confidence, unclear expectations, little tolerance for admin complexity

### Walkthrough
1. Log in and enter learner chat.
2. Read the activity framing.
3. Start conversation with TINA.
4. Use quick replies when offered.
5. Finish and read the final summary.

### Student Findings

#### 1. Student entry is better, but the first action is still not strong enough
- Severity: High
- Problem:
  - the top area explains context, but the first thing to do still relies on the learner understanding the page on their own
- Improvement:
  - add a stronger first action cue:
    - `Start by telling TINA what feels hardest right now`

#### 2. The activity header is improved, but still slightly dense before first input
- Severity: Medium
- Problem:
  - even compacted, the header still competes with the conversation itself
- Improvement:
  - make the header collapsible after the first learner response
  - keep only a tiny sticky line with activity name and outcome

#### 3. The conversation is supportive, but some identity framing still leans instructor-like
- Severity: High
- Problem:
  - preservice users still risk feeling like they are answering from a level of classroom ownership they do not fully have
- Improvement:
  - continue shifting examples toward practicum, planning, observation, and future teaching decisions

#### 4. The report is more coaching-oriented now, but still visually resembles an evaluation artifact
- Severity: Medium
- Problem:
  - the modal presentation still feels formal and official
- Improvement:
  - reduce certificate-like styling for learners
  - make the final summary look more like a guided debrief than an award/report artifact

#### 5. My Account is useful, but not learner-friendly enough yet
- Severity: Medium
- Problem:
  - history and export tools are useful, but the page feels like a utility area rather than a learning area
- Improvement:
  - add a simple `What I learned` summary and `Continue reflection` emphasis
  - de-emphasize export-first framing for students

### Student What Works
- Shared chatbot identity remains coherent.
- Learner preview/testing entry is now much smoother.
- Outcome-oriented framing is improving.
- Stage-based progress is more human than turn-only progress.

## Cross-Role Synthesis

### Main Product Gap
- The instructor and student experiences are improving independently, but the transition between them still feels weak.
- TINA needs a stronger shared classroom loop:
  - instructor creates
  - learner completes
  - instructor interprets
  - learner follows up

### Most Important Improvements To Prioritize
1. Add an explicit activity lifecycle for instructors.
2. Add `Preview learner experience` as a first-class instructor action.
3. Collapse the learner header after session start.
4. Reframe learner final summary as a coaching debrief rather than a formal report.
5. Upgrade activity analytics from counts to instructional signals.
6. Add class/section organization for assignment and review.

## Recommended Product Direction
- Keep one TINA chatbot.
- Keep activity-context customization.
- Make the product feel less like a tool with separate admin and user panels, and more like a shared learning loop with role-specific surfaces.

## Ready-To-Use Feedback Summary
TINA now has a credible shared-chatbot structure for instructors and students, but the product still feels more system-driven than class-driven. Instructors can configure and monitor activities, and students can complete reflective chats, yet the handoff between those roles is not fully smooth. The next improvements should focus on lifecycle clarity, learner preview, activity-to-outcome analytics, and a more lightweight, action-first student flow.
