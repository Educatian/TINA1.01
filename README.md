# 🍌 TINA - Teacher Identity Navigation Assistant

<div align="center">

![TINA Banner](https://img.shields.io/badge/TINA-Teacher_AI_Coach-F4D03F?style=for-the-badge&logo=sparkles&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.1-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**An AI-powered reflective coaching tool for educators exploring their teacher identity and AI integration practices**

[🚀 Live Demo](https://tina-adie.netlify.app) • [📖 Documentation](#features) • [🛠️ Setup](#getting-started)

</div>

---

## ✨ What is TINA?

TINA is a **10-minute AI-guided conversation** designed to help teachers through a session of up to 12 TINA responses:

- 🪞 **Reflect** on their teaching identity and core values
- 🤖 **Explore** how AI is shaping their classroom practice  
- 🌍 **Consider** the societal implications of AI in education
- 📊 **Receive** a personalized reflection report with actionable insights

Built with the Nanobanana design system, TINA provides a warm, professional experience that feels like talking to a supportive colleague.

For the structured activity customization model that keeps one shared chatbot while allowing instructor-defined learning context, see [docs/experience-customization-spec.md](./docs/experience-customization-spec.md).

---

## 🎯 Key Features

| Feature | Description |
|---------|-------------|
| 💬 **Reflective Dialogue** | AI-guided conversation using Gemini 2.5 Flash, streamed with a live typing effect |
| 🔐 **Server-Side AI Proxy** | All Gemini/HuggingFace keys live in a Netlify Function (`netlify/functions/ai-proxy.mts`) — never in the browser bundle. Supabase-JWT auth + per-user rate limiting |
| 📊 **Personalized Reports** | Detailed PDF reports with teacher profiling, grounded in the learner's own verbatim excerpts |
| 🔁 **Cross-Session Loop** | The next session opens by revisiting the previous report's "One Next Move" (+ a learner-chosen carry-forward question) — ALACT as a real cycle |
| 📈 **Reflection Trajectory** | Learners see their own reflection-depth bars (turn by turn) in the closing report |
| 🎓 **Teacher Clustering** | NLP-based classification into 3 teacher types |
| 🎤 **Voice Input** | Speech-to-text for natural conversation |
| 🧍 **TINA Character States** | Full-body avatar (idle/thinking/listening/walking/celebrating) driven by the selected coaching move; calm micro-motion, `prefers-reduced-motion` respected |
| 🧭 **Coaching-Move Engine** | Deterministic per-turn coaching moves (Korthagen ALACT + reflection levels) that steer the LLM *and* log research telemetry |

---

## 🧭 Coaching-Move Engine & Research Telemetry

TINA includes a **pure, unit-tested coaching engine** (`src/services/coachingEngine.ts`) built on a single design spine: **one "coaching move" is simultaneously (a) the control signal that shapes TINA's next reply and (b) the logged research event.** The LLM stays the *renderer*; move classification, selection, and verification live in deterministic code (the proven `classify → select → verify` pattern). The big TINA persona/system prompt is preserved — the engine only injects a short per-turn directive.

**Theory anchor — Korthagen's ALACT reflection cycle**
(Action → Looking back → Awareness of essential aspects → Creating alternative methods → Trial; Korthagen & Vasalos, 2005) plus **reflection levels** (technical → descriptive → critical; Van Manen, 1977; Hatton & Smith, 1995).

**The 9-move taxonomy** (single source of truth, consumed by selector, renderer directive, logger, and dashboard):

| Move | ALACT phase | Purpose |
|------|-------------|---------|
| `ELICIT_EXPERIENCE` | Action | Surface one concrete teaching moment |
| `LOOK_BACK` | Looking back | What happened / was wanted / felt / done |
| `NAME_ESSENTIAL` | Awareness | Name the identity / value / AI tension underneath |
| `DEEPEN_REFLECTION` | Awareness | Push descriptive → critical when a turn stays shallow |
| `SCAFFOLD_WITH_STEM` | Awareness | After 2+ consecutive shallow turns, offer a sentence stem instead of another open why-probe |
| `REFRAME_PERSPECTIVE` | Creating alternatives | Invite an alternative framing |
| `CONNECT_VALUE_TO_ACTION` | Trial | Connect the value to one small next move to try |
| `AFFIRM_AND_HOLD` | Looking back | Validate + hold a safe, low-confusion space |
| `CLOSE_SYNTHESIS` | Closing | End-of-session TINA Reflection Report |

- **Classify** (`classifyTurn`): lightweight, LLM-free heuristics → `{reflectionLevel, contentTags, cues}`.
- **Select** (`selectMove`): one move per turn; advances the ALACT cycle and lands `CLOSE_SYNTHESIS` near the ~10-minute / 12-turn budget; deepens shallow turns; holds the space on affect.
- **Verify** (`verifyRender`): a "mirror, not advisor" guard. On a violation, one nudged regeneration, else pass-through — never blocks the live class.

**Per-turn telemetry** is logged via `analyticsService.saveCoachingTurn(...)` into the `coaching_turns` table (the move log *is* the analytics data; no parallel pipeline). It is **best-effort and feature-detected**: with the SQL not applied or the engine disabled/erroring, the chat behaves exactly as before.

- **Flag:** `VITE_COACHING_ENGINE` (defaults **on**; set `off` to disable).
- **Schema:** apply `tina-coaching-telemetry.sql` in the Supabase SQL Editor (idempotent, additive-only, RLS = per-user + instructor-read). The Admin Dashboard **Coaching Moves** tab shows reflection-level distribution, move-usage frequency, ALACT phase coverage, per-learner reflection trajectory, and CSV/JSON export — with a clean "not enabled" state until the SQL is applied.
- **Tests:** `npm test` (Node ≥ 22 `node --test`, 27 cases covering classify/select/verify, every move reachable, shallow → `DEEPEN_REFLECTION`, end-of-time → `CLOSE_SYNTHESIS`).

---

## 🧠 NLP Analysis Pipeline

TINA includes advanced analytics powered by HuggingFace models:

- **Sentiment Analysis** - Emotional tone detection
- **6-Emotion Classification** - Joy, sadness, anger, fear, surprise, disgust
- **Self-Efficacy Detection** - Confidence level assessment
- **Discourse Type Analysis** - Reflection, concern, commitment, etc.
- **AI Attitude Profiling** - Enthusiast, skeptic, pragmatist, anxious

---

## 🏗️ Tech Stack

```
Frontend     │  React 18 + TypeScript + Vite
Styling      │  CSS with Nanobanana Design System
AI/Chat      │  Google Gemini 2.5 Flash
NLP          │  HuggingFace Inference API
Database     │  Supabase (PostgreSQL)
Auth         │  Supabase Auth
PDF          │  jsPDF
Hosting      │  Netlify
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Educatian/TINA1.01.git
cd TINA1.01

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Create a `.env` file with:

```env
# client-side (safe to expose)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# server-side ONLY — read by netlify/functions/ai-proxy.mts
GEMINI_API_KEY=your_gemini_api_key
HF_API_KEY=your_huggingface_api_key
```

### Run Locally

```bash
netlify dev   # serves Vite AND the AI proxy function together
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Security notes:
- AI keys are **never** compiled into the client bundle. All Gemini/HuggingFace
  calls go through `/.netlify/functions/ai-proxy`, which verifies the learner's
  Supabase access token and enforces a per-user rate limit
  (apply `tina-api-proxy.sql` to enable the limit; auth is enforced regardless).
- Existing Netlify sites keep working without dashboard changes: the function
  falls back to the legacy `VITE_`-prefixed env values server-side.
- Optional migrations: `tina-coaching-telemetry.sql` (move telemetry),
  `tina-api-proxy.sql` (rate limit), `tina-reflection-loop.sql` (carry-forward).

---

## 📁 Project Structure

```
src/
├── components/
│   ├── ChatInterface.tsx    # Main conversation UI
│   ├── Login.tsx            # Landing page with login
│   ├── ReportModal.tsx      # Reflection report display
│   ├── ProgressBar.tsx      # Session progress indicator
│   └── QuickReply.tsx       # Quick selection buttons
├── services/
│   ├── nlpService.ts        # HuggingFace NLP integration
│   └── analyticsService.ts  # Affect-aware logging
├── hooks/
│   ├── useAuth.ts           # Authentication hook
│   └── useSession.ts        # Session management
└── types/
    └── index.ts             # TypeScript definitions
```

---

## 🎨 Design Philosophy

TINA uses the **Nanobanana** design system:

- 🍌 Warm yellow primary colors for approachability
- 💬 Friendly, conversational UI elements
- ✨ Subtle animations for engagement
- 📱 Mobile-first responsive design

---

## 📊 Teacher Clusters

TINA classifies teachers into three profiles:

| Cluster | Description |
|---------|-------------|
| 🟠 **Thoughtful Explorer** | Ethically aware but hesitant about AI |
| 🔵 **Determined Pioneer** | Motivated but lacking resources/support |
| 🟢 **AI Champion** | Confident and prepared with AI tools |

---

## 🔐 Privacy & Ethics

- No personally identifiable information is collected
- Conversations are stored securely in Supabase
- Teachers can delete their data at any time
- AI responses prioritize safety and professional guidance

---

## 📝 License

MIT License - feel free to use and adapt for educational purposes.

---

## 🙏 Acknowledgments

Built for educational research by the Nanobanana team.

---

<div align="center">

**Made with 💛 for educators everywhere**

</div>
