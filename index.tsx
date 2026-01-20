import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI, Chat } from "@google/genai";
import html2canvas from "html2canvas";

// TINA System Prompt
const SYSTEM_INSTRUCTION = `
You are TINA (Teacher Identity Navigation Assistant).
Your goal is to help teachers (users) reflect on their Teacher Identity, AI usage, and the relationship between AI and society through a 10-minute conversational coaching session.

0) Core Principles
- You are not an evaluator. Do not grade or judge.
- You are a reflective partner and a "Learning Companion".
- "Diagnosis" is a reflection-based summary of tendencies, not a clinical diagnosis.
- Avoid definitive statements ("You are X"). Use tendency-based expressions ("You show a tendency for X", "X appears to be present").
- Respect the user's experience. Keep questions short and clear. If the user speaks at length, extract and reflect the core essence.
- Safety First: If sensitive topics (depression, self-harm, violence, abuse) arise, prioritize safety and recommend professional help.

1) Three Analysis Layers (Internal Tracking)
Throughout the conversation, internally classify and summarize user inputs into these 3 layers. Do not tell the user you are "analyzing".
Layer 1: Who am I (Teacher Identity)
- Core Values (e.g., Equity, Care, Achievement, Autonomy, Connection, Rigor, Inquiry)
- Role Identity (e.g., Deliverer, Facilitator, Coach, Designer, Evaluator, Mentor, Researcher)
- Efficacy/Anxiety (Sources of confidence/anxiety)
- Belief vs. Practice Tension (Mismatch between words and actions)

Layer 2: How is my AI Practice (AI Practice Profile)
- Purpose (Design, Material Generation, Feedback, Grading, Admin, Individualization, Operations)
- Stage (Idea -> Draft -> Validation -> Application): Ask specifically *where* in the workflow AI stops and you begin. (e.g., "Does AI write the final draft, or just the outline?")
- Control Level (Teacher-in-the-loop: Review, Edit, Fact-check): Ask specifically *how* you verify or modify the output. (e.g., "Do you fact-check every claim?" "Do you rewrite the tone?" "Do you ever use it unedited?")
- Ethics/Safety (Privacy, Copyright, Bias, Fairness, Transparency, Disclosure)

Layer 3: AI and Society (AI-Society Reflection)
- Policy/Norm Alignment: Ask about the "gray zones" where technology outpaces school rules. How do they navigate policy gaps?
- Responsibility & Power: Probe "Epistemic Authority". When AI provides an answer, who verifies truth? Does it shift power from teacher/student to the algorithm?
- Fairness/Gap: Ask specifically about the "Digital Divide" (access to paid vs. free tools) and "Cultural Bias" (whose knowledge is represented?).
- Trust/Transparency: Ask about "Explainability" and "Hidden Curriculum". What are we teaching students about truth/effort? Can you explain to a parent how the AI reached its conclusion?

2) Time Limits & Rules (10-minute Structure)
Operate as a 10-minute session, approximated by a "Turn-based Timebox".
Max 12 turns (your responses).
Stages:
- Orientation (1 turn)
- Layer 1 Questions (approx. 4 turns)
- Layer 2 Questions (approx. 4 turns): PRIORITIZE probing 'Stage' and 'Control Level'. Don't just ask "what do you use it for?", ask "how do you verify it?" and "how much do you edit it?".
- Layer 3 Questions (approx. 2 turns): MECHANISM - Connect societal issues back to their Core Values (Layer 1). (e.g., "You mentioned valuing 'Equity'—how do you reconcile that with students having unequal access to AI tools?")
- Closing/Summary Report (Last 1 turn)

Management per turn:
(a) Reflect core essence of user's previous statement (1-2 sentences).
(b) Ask 1 Question (or choice-based question). Keep it short. Only 1 question at a time.
If user answer is very short, you may add 1 follow-up probe (max 2 questions total not recommended, prefer 1).

3) Question Design (TINA's Persona)
Tone: Warm, encouraging, professional but friendly. Like a supportive colleague.
Avoid: "Clinical diagnosis", "You are definitely...", "I will analyze you".
Recommend: "Did I understand correctly?", "Could you say more?", "What was the reason for that choice?"

4) Orientation (Turn 1)
Start with a warm, welcoming "Learning Companion" vibe.
- Introduce yourself as TINA, a companion for navigating teacher identity.
- Explain value: "I'm here to help you pause and reflect on your teaching values and how AI fits into your classroom journey."
- Create a safe space: "Think of this as a quiet moment for yourself to explore your thoughts."
- DO NOT explicitly say "I will provide a summary report" or "Do not share PII" in this opening hook (unless the user violates safety). Just start naturally.

Example Opening: "Hello! I'm TINA, your reflective learning companion. I'm here to support you in exploring your teacher identity and how AI is shaping your practice. Think of me as a mirror for your thoughts—helping you connect your values to your classroom decisions. Shall we start with what's been on your mind lately regarding AI in your class?"

5) Final Turn: TINA Reflection Report
Provide the report at the end (within 12 turns). Use "tendency/possibility/observation" language.
Format:
**TINA Reflection Report (10-minute Consultation)**

**1) Teacher Identity Snapshot**
- Main Role Identity (Observed):
- Perceived Strengths:
- Potential Tensions (Belief vs. Practice):

**2) Core Values Estimation**
(Based on the conversation, list 3-5 values that appear to guide the user, e.g., Equity, Care, Efficiency, Autonomy)
- [Value Name]: [Brief observation on how this value manifests]
- [Value Name]: [Brief observation]

**3) AI Use Profile**
- Main Purpose:
- Control Level (Review/Edit habits):
- Well-established Routines:
- Routines to Strengthen:

**4) AI-Society Reflection**
- Transparency/Explanation Strategy:
- Considerations for Fairness/Gap:
- Policy/Norm Alignment Check:

**5) Integrated Insight**
(4-6 sentences summarizing how identity influences AI choices and their social meaning.)

**6) Next Reflection Questions**
Q1:
Q2:
Q3:

**7) Practical Next Step**
(One small, concrete action to try in the next class/task.)

6) Safety/Ethics Guide
- If PII mentioned: Ask to generalize.
- If Harm mentioned: Prioritize safety, suggest help, no clinical advice.

8) START IMMEDIATELY
Start with Orientation now.
`;

const App = () => {
  const [messages, setMessages] = useState<{ role: "user" | "model"; text: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const hasInitialized = useRef(false);

  // Initialize Chat Session
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initChat = async () => {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
        const chat = ai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        });
        setChatSession(chat);

        setIsLoading(true);
        const response = await chat.sendMessage({ message: "Start the session." });
        setMessages([{ role: "model", text: response.text || "" }]);
        setIsLoading(false);

      } catch (error) {
        console.error("Error initializing chat:", error);
        setMessages([{ role: "model", text: "Error initializing TINA. Please check API Key." }]);
      }
    };

    initChat();
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let newTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            newTranscript += event.results[i][0].transcript;
          }
        }
        if (newTranscript) {
          setInput((prev) => (prev + " " + newTranscript).trim());
        }
      };

      recognition.onend = () => {
        // Automatically restart if state says we are recording (keep alive), 
        // or just stop. Here we just stop to be simple and robust.
        setIsRecording(false);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !chatSession || isLoading) return;

    // Stop recording if active when sending
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMsg });
      const botMsg = response.text || "";
      setMessages((prev) => [...prev, { role: "model", text: botMsg }]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [...prev, { role: "model", text: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Could not start recognition:", e);
        setIsRecording(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const downloadTranscript = () => {
    const timestamp = new Date().toLocaleString();
    const header = `TINA - Teacher Identity Navigation Assistant\nSession Date: ${timestamp}\n\n`;
    const content = messages.map(m => `[${m.role.toUpperCase()}]\n${m.text}`).join("\n\n");
    const fullText = header + content;

    const blob = new Blob([fullText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tina-session-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadJSON = () => {
    const data = {
      app: "TINA",
      date: new Date().toISOString(),
      messages: messages
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tina-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadSnapshot = async () => {
    if (!chatContainerRef.current) return;

    try {
      // Clone the node to capture full height
      const original = chatContainerRef.current;
      const clone = original.cloneNode(true) as HTMLElement;
      
      // Create a header for the snapshot to look like a report card
      const headerDiv = document.createElement("div");
      headerDiv.style.padding = "20px";
      headerDiv.style.borderBottom = "2px solid #52796F";
      headerDiv.style.marginBottom = "24px";
      headerDiv.style.textAlign = "center";
      headerDiv.style.fontFamily = "'Press Start 2P', cursive";
      headerDiv.style.color = "#52796F";
      headerDiv.innerHTML = `
        <h1 style="margin:0; font-size: 20px;">TINA</h1>
        <p style="margin:10px 0 0; font-family: 'Outfit', sans-serif; font-size: 14px; color: #666; font-weight: 500;">Teacher Identity Navigation Assistant</p>
        <p style="margin:5px 0 0; font-family: 'Outfit', sans-serif; font-size: 12px; color: #999;">${new Date().toLocaleString()}</p>
      `;
      
      // Prepend header
      clone.insertBefore(headerDiv, clone.firstChild);

      // Style the clone to be fully visible and off-screen
      clone.style.position = "absolute";
      clone.style.top = "-9999px";
      clone.style.left = "-9999px";
      clone.style.width = `${Math.max(original.clientWidth, 600)}px`; // Ensure reasonable width
      clone.style.height = "auto";
      clone.style.overflow = "visible";
      clone.style.background = "#FDFBF7"; // Match background
      clone.style.padding = "40px";
      clone.style.boxSizing = "border-box";
      
      document.body.appendChild(clone);
      
      // Wait a moment for images/fonts if needed (though text based is usually instant)
      const canvas = await html2canvas(clone, {
        scale: 2, // Retain quality
        backgroundColor: "#FDFBF7" 
      });
      
      document.body.removeChild(clone);

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `tina-snapshot-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("Snapshot failed:", err);
      alert("Failed to create snapshot.");
    }
  };

  // Styles
  const primaryColor = "#84A98C"; // Soft Sage
  const primaryDark = "#52796F"; // Darker Sage
  const recordingColor = "#E76F51"; // Terra Cotta for recording
  const userBubbleColor = "#84A98C";
  const userTextColor = "#ffffff";
  const modelBubbleColor = "#ffffff";
  const modelTextColor = "#2F3E46";
  const backgroundColor = "#FDFBF7"; // Creamy off-white

  return (
    <div style={{
      fontFamily: "'Outfit', 'Segoe UI', sans-serif", 
      maxWidth: "800px",
      margin: "0 auto",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      backgroundColor: backgroundColor,
      color: "#2F3E46"
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(10px)",
        padding: "16px 24px",
        borderBottom: "2px solid rgba(0,0,0,0.05)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div>
            <h1 style={{ 
              margin: 0, 
              color: primaryDark, 
              fontSize: "1.2rem",
              fontFamily: "'Press Start 2P', cursive", 
              lineHeight: "1.5"
            }}>TINA</h1>
            <p style={{ 
              margin: "4px 0 0", 
              color: "#6b7280", 
              fontSize: "0.85rem", 
              opacity: 0.9,
              letterSpacing: "0.5px",
              fontWeight: 400
            }}>
              Teacher Identity Navigation Assistant
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            onClick={downloadTranscript}
            title="Download Transcript"
            style={{
              padding: "8px 12px",
              fontSize: "0.8rem",
              backgroundColor: "#fff",
              border: `2px solid ${primaryColor}`,
              borderRadius: "8px",
              cursor: "pointer",
              color: primaryDark,
              fontFamily: "'Outfit', sans-serif",
              fontWeight: "600",
              transition: "all 0.1s ease",
              boxShadow: "2px 2px 0px rgba(132, 169, 140, 0.5)"
            }}
            onMouseOver={(e) => {
               e.currentTarget.style.transform = "translate(-1px, -1px)";
               e.currentTarget.style.boxShadow = "3px 3px 0px rgba(132, 169, 140, 0.5)";
            }}
            onMouseOut={(e) => {
               e.currentTarget.style.transform = "translate(0, 0)";
               e.currentTarget.style.boxShadow = "2px 2px 0px rgba(132, 169, 140, 0.5)";
            }}
          >
            TXT
          </button>
          <button 
            onClick={downloadJSON}
            title="Download JSON Data"
            style={{
              padding: "8px 12px",
              fontSize: "0.8rem",
              backgroundColor: "#fff",
              border: `2px solid ${primaryColor}`,
              borderRadius: "8px",
              cursor: "pointer",
              color: primaryDark,
              fontFamily: "'Outfit', sans-serif",
              fontWeight: "600",
              transition: "all 0.1s ease",
              boxShadow: "2px 2px 0px rgba(132, 169, 140, 0.5)"
            }}
            onMouseOver={(e) => {
               e.currentTarget.style.transform = "translate(-1px, -1px)";
               e.currentTarget.style.boxShadow = "3px 3px 0px rgba(132, 169, 140, 0.5)";
            }}
            onMouseOut={(e) => {
               e.currentTarget.style.transform = "translate(0, 0)";
               e.currentTarget.style.boxShadow = "2px 2px 0px rgba(132, 169, 140, 0.5)";
            }}
          >
            JSON
          </button>
          <button 
            onClick={downloadSnapshot}
            title="Download Snapshot Image"
            style={{
              padding: "8px 12px",
              fontSize: "0.8rem",
              backgroundColor: primaryColor,
              border: `2px solid ${primaryColor}`,
              borderRadius: "8px",
              cursor: "pointer",
              color: "#fff",
              fontFamily: "'Outfit', sans-serif",
              fontWeight: "600",
              boxShadow: "2px 2px 0px rgba(82, 121, 111, 0.3)",
              transition: "all 0.1s ease"
            }}
            onMouseOver={(e) => {
               e.currentTarget.style.transform = "translate(-1px, -1px)";
               e.currentTarget.style.boxShadow = "3px 3px 0px rgba(82, 121, 111, 0.3)";
            }}
            onMouseOut={(e) => {
               e.currentTarget.style.transform = "translate(0, 0)";
               e.currentTarget.style.boxShadow = "2px 2px 0px rgba(82, 121, 111, 0.3)";
            }}
          >
            IMG
          </button>
        </div>
      </header>

      {/* Chat Area */}
      <div 
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          backgroundColor: backgroundColor,
          backgroundImage: "radial-gradient(#d4d4d4 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }}
        id="chat-content"
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              backgroundColor: msg.role === "user" ? userBubbleColor : modelBubbleColor,
              color: msg.role === "user" ? userTextColor : modelTextColor,
              padding: "16px 20px",
              borderRadius: msg.role === "user" ? "12px 12px 0px 12px" : "12px 12px 12px 0px",
              boxShadow: "4px 4px 0px rgba(0,0,0,0.05)",
              border: msg.role === "model" ? "2px solid #E5E7EB" : `2px solid ${primaryDark}`,
              whiteSpace: "pre-wrap",
              lineHeight: "1.6",
              fontSize: "1rem", 
              position: "relative"
            }}
          >
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div style={{ 
            alignSelf: "flex-start", 
            color: primaryDark, 
            fontStyle: "normal", 
            paddingLeft: "12px", 
            fontSize: "0.9rem",
            fontFamily: "'Outfit', sans-serif"
          }}>
            <span className="blink">●</span> TINA is thinking...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: "20px 24px",
        backgroundColor: "#ffffff",
        borderTop: "2px solid rgba(0,0,0,0.05)",
        display: "flex",
        gap: "12px",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.02)"
      }}>
        <button
          onClick={handleMicClick}
          title={isRecording ? "Stop Recording" : "Start Voice Input"}
          style={{
            width: "50px",
            height: "50px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isRecording ? recordingColor : "#f1f3f4",
            color: isRecording ? "#fff" : "#5f6368",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            transition: "all 0.2s",
            boxShadow: isRecording ? "0 0 10px rgba(231, 111, 81, 0.5)" : "none",
            animation: isRecording ? "pulse 1.5s infinite" : "none"
          }}
        >
          {/* Simple Mic Icon */}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
          </svg>
        </button>
        <style>{`
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 111, 81, 0.7); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(231, 111, 81, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(231, 111, 81, 0); }
          }
        `}</style>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isRecording ? "Listening..." : "Share your thoughts..."}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: "14px 20px",
            borderRadius: "12px",
            border: isRecording ? `2px solid ${recordingColor}` : "2px solid #e0e0e0",
            fontSize: "1rem",
            outline: "none",
            backgroundColor: "#f8f9fa",
            transition: "all 0.2s",
            fontFamily: "'Outfit', sans-serif"
          }}
          onFocus={(e) => {
            if(!isRecording) {
              e.target.style.borderColor = primaryColor;
              e.target.style.backgroundColor = "#fff";
              e.target.style.boxShadow = `4px 4px 0px rgba(132, 169, 140, 0.2)`;
            }
          }}
          onBlur={(e) => {
             if(!isRecording) {
              e.target.style.borderColor = "#e0e0e0";
              e.target.style.backgroundColor = "#f8f9fa";
              e.target.style.boxShadow = "none";
             }
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          style={{
            padding: "0 28px",
            backgroundColor: isLoading || !input.trim() ? "#cad2c5" : primaryColor,
            color: "#ffffff",
            border: "none",
            borderRadius: "12px",
            fontSize: "1rem",
            cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontFamily: "'Outfit', sans-serif",
            transition: "all 0.1s",
            boxShadow: isLoading || !input.trim() ? "none" : "4px 4px 0px rgba(82, 121, 111, 0.3)"
          }}
          onMouseDown={(e) => !isLoading && (e.currentTarget.style.transform = "translate(2px, 2px)", e.currentTarget.style.boxShadow = "2px 2px 0px rgba(82, 121, 111, 0.3)")}
          onMouseUp={(e) => !isLoading && (e.currentTarget.style.transform = "translate(0, 0)", e.currentTarget.style.boxShadow = "4px 4px 0px rgba(82, 121, 111, 0.3)")}
        >
          SEND
        </button>
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);
root.render(<App />);