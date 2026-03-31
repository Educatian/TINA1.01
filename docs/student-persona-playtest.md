# Student Persona Playtest

## Scope
- App: TINA learner chat flow
- Environment: localhost learner preview mode
- Method: heuristic playtest walkthrough based on current UI flow, live local behavior, and component-level inspection
- Persona: mid-program preservice teacher who is curious about AI, has limited classroom ownership, and wants quick guidance without feeling judged

## Persona Snapshot
- Name: Mina
- Stage: second-year preservice teacher
- Goal: understand how AI can support lesson planning and reflection before practicum
- Constraints: limited teaching experience, low confidence, short attention span, unsure what "good" AI use looks like
- Motivation: wants practical help and wants to sound competent without being evaluated

## Test Scenario
1. Mina logs in and enters the learner chat.
2. She reads the activity context and decides whether this feels relevant.
3. She starts a reflection conversation with TINA.
4. She uses quick replies when available.
5. She continues until a report is generated.
6. She decides whether the report feels useful, fair, and actionable.

## Overall Result
- The flow is usable and now technically testable in learner preview mode.
- The strongest part is the same-TINA, low-friction chat interaction.
- The biggest weakness is persona mismatch: the app still speaks more to an in-service teacher than to a preservice learner.
- The second weakness is expectation clarity: the learner sees context, but not a strong "what you will walk away with" promise.

## Findings

### 1. The chatbot voice still assumes an in-service teacher identity
- Severity: High
- Why it matters: Mina is not fully in charge of a classroom yet, so prompts about "your teaching" and "your class" can feel slightly fake or distancing.
- Evidence in experience:
  - login and report language still emphasize teacher identity
  - core system prompt frames the user as an active teacher already running a class
- Impact:
  - lowers identification with the tool
  - may cause short or guarded answers
- Recommendation:
  - when `learnerLevel` is preservice-oriented, switch examples and wording to `lesson planning`, `microteaching`, `practicum`, `observation`, and `future classroom decisions`

### 2. Quick reply prompts are not well aligned to preservice learners
- Severity: High
- Why it matters: preservice learners may not yet "use AI in teaching" in a stable way, so answer options can feel forced.
- Current examples:
  - "How often do you use AI in your teaching?"
  - "How has AI impacted your teaching?"
- Impact:
  - makes the learner improvise an identity they do not yet have
  - reduces trust in the chatbot's relevance
- Recommendation:
  - create a preservice quick-reply set:
    - `How often do you use AI for coursework or lesson planning?`
    - `Where do you feel least confident?`
    - `What kind of practicum situation are you preparing for?`

### 3. The activity context is clearer now, but still front-loads metadata over action
- Severity: Medium
- Why it matters: Mina wants to know `what do I do now` and `what do I get at the end`.
- Current experience:
  - title, topic, level, time, output, rules are visible
  - but the most actionable statement is still visually similar to the rest
- Impact:
  - mild cognitive load before first input
  - chat start feels more like reading setup than starting a guided task
- Recommendation:
  - add a short action line directly under the title:
    - `In this activity, you will leave with a short reflection you can use in class planning.`

### 4. Progress feedback is system-shaped, not learner-shaped
- Severity: Medium
- Why it matters: `Turn 3`, `Turn 4` is easy for the system, but not the most meaningful progress language for a learner.
- Impact:
  - progress feels mechanical
  - learner may not know whether they are doing well or simply waiting
- Recommendation:
  - consider replacing or supplementing turn count with stage language:
    - `Getting started`
    - `Exploring your view`
    - `Connecting to practice`
    - `Preparing your reflection`

### 5. The report can still feel evaluative even when the tone is supportive
- Severity: Medium
- Why it matters: preservice learners are sensitive to being judged by expert systems.
- Current experience:
  - report framing is thoughtful, but cluster labels and teacher-identity framing still imply diagnosis
- Impact:
  - some learners may read the report as a score instead of a reflection aid
- Recommendation:
  - reframe outputs toward:
    - `What stood out in your reflection`
    - `Emerging strengths`
    - `Questions to carry into practicum`
    - `Next small move`

### 6. The app needs a more explicit success promise for first-time learners
- Severity: Medium
- Why it matters: Mina should know exactly why spending 10 minutes here is worth it.
- Current experience:
  - there is an output label, but not a strong learner-facing benefit statement
- Recommendation:
  - before the first TINA message, show a compact outcome box:
    - `You will finish with:`
    - `1 short reflection`
    - `1 next-step idea`
    - `1 question to carry into practicum`

## What Works Well
- The learner flow is now accessible without a hard assignment dependency in preview mode.
- The same-chatbot model keeps the experience coherent.
- The activity header is moving in the right direction and no longer dominates as much as before.
- The output-oriented activity model is a strong fit for coursework and guided reflection.

## Recommended Next Iteration
1. Add preservice-specific wording mode to the system prompt.
2. Create a learner-level-aware quick-reply bank.
3. Replace pure turn count with stage-based progress language.
4. Add a compact "what you will leave with" outcome row above the chat.
5. Reframe the final report away from typology and toward coaching language.

## Suggested Ready-to-Use Feedback Summary
TINA is becoming a strong guided reflection tool for preservice learners, but it still talks like the user is already an in-service teacher. The main improvement opportunity is not the chatbot engine itself, but the learner framing around it: preservice wording, clearer outcome promises, and less evaluative report language would make the experience feel more relevant and safer. The current interaction model is strong enough to keep building on.
