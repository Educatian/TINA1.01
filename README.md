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
| 💬 **Reflective Dialogue** | AI-guided conversation using Gemini 2.5 Flash |
| 📊 **Personalized Reports** | Detailed PDF reports with teacher profiling |
| 🎓 **Teacher Clustering** | NLP-based classification into 3 teacher types |
| 📈 **Progress Tracking** | Visual progress bar showing session advancement |
| 🎤 **Voice Input** | Speech-to-text for natural conversation |
| 📱 **Responsive Design** | Beautiful on desktop and mobile |

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
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_HUGGINGFACE_API_KEY=your_huggingface_api_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Notes:
- `VITE_GEMINI_API_KEY` is the primary frontend key used by the chat experience.
- `VITE_HUGGINGFACE_API_KEY` is required for the analytics and clustering features.

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
