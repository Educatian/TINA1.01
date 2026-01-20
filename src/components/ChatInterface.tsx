import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleGenAI, Chat } from '@google/genai';
import { useAuth } from '../hooks/useAuth';
import { createSession, updateSession, completeSession, getSession } from '../hooks/useSession';
import { classifyTeacherCluster } from '../services/nlpService';
import {
    initSessionTracking,
    startTurnTracking,
    analyzeUserTurn,
    saveTurnAnalytics,
    saveSessionAnalytics,
    markVoiceInputUsed
} from '../services/analyticsService';
import { ReportModal } from './ReportModal';
import { QuickReply, QUICK_REPLY_QUESTIONS, QuickReplyQuestion } from './QuickReply';
import { ProgressBar } from './ProgressBar';
import type { Message, Session } from '../types';

// Enhanced TINA System Prompt with Critical Thinking
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

Layer 3: AI and Society (AI-Society Reflection) - CRITICAL THINKING FOCUS
- Policy/Norm Alignment: Ask about the "gray zones" where technology outpaces school rules. How do they navigate policy gaps? Ask: "What do you do when school rules don't cover a specific AI situation?"
- Responsibility & Power (Epistemic Authority): When AI provides an answer, who verifies truth? Does it shift power from teacher/student to the algorithm? Ask: "When AI gives an answer, who decides if it's correct - you, the student, or the AI itself?"
- Fairness/Gap (Digital Divide): Ask specifically about paid vs. free AI tool access gaps. Ask: "Do you notice differences between students who have paid AI tools at home versus those who don't?" Also probe Cultural Bias: "Whose knowledge and perspective do you think AI represents?"
- Trust/Transparency (Hidden Curriculum): Ask about what we implicitly teach students about truth/effort. Ask: "What message might students get about effort and learning when AI can do things instantly?" "Can you explain to a parent how the AI reached its conclusion?"
- Critical Reflection: "Do you think AI use in education reinforces or challenges existing inequalities?"

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

interface ChatInterfaceProps {
    onSessionComplete: (sessionId: string) => void;
}

export function ChatInterface({ onSessionComplete }: ChatInterfaceProps) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [turnCount, setTurnCount] = useState(0);
    const [showReportModal, setShowReportModal] = useState(false);
    const [completedSession, setCompletedSession] = useState<Session | null>(null);
    // Quick Reply state
    const [currentQuickReply, setCurrentQuickReply] = useState<QuickReplyQuestion | null>(null);
    const [quickReplyResponses, setQuickReplyResponses] = useState<Record<string, string>>({});

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const hasInitialized = useRef(false);

    // Check for resume session from navigation state
    const resumeSession = (location.state as any)?.resumeSession as Session | undefined;

    // Initialize Chat Session
    useEffect(() => {
        if (hasInitialized.current || !user) return;
        hasInitialized.current = true;

        const initChat = async () => {
            try {
                // Check if resuming a session
                if (resumeSession) {
                    setSessionId(resumeSession.id);
                    const existingMessages = resumeSession.messages as Message[] || [];
                    setMessages(existingMessages);
                    setTurnCount(resumeSession.turn_count || 0);

                    // Initialize AI with history context
                    const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
                    const historyContext = existingMessages.map(m =>
                        `${m.role === 'user' ? 'User' : 'TINA'}: ${m.text}`
                    ).join('\n\n');

                    const chat = ai.chats.create({
                        model: 'gemini-2.0-flash',
                        config: {
                            systemInstruction: SYSTEM_INSTRUCTION + `\n\nPREVIOUS CONVERSATION CONTEXT:\n${historyContext}\n\nContinue the conversation naturally from where we left off.`,
                        },
                    });
                    setChatSession(chat);

                    // Clear the navigation state
                    navigate('/', { replace: true, state: {} });
                    return;
                }

                // Create new session in Supabase
                const newSessionId = await createSession(user.id);
                if (newSessionId) {
                    setSessionId(newSessionId);
                    // Initialize analytics tracking
                    initSessionTracking();
                }

                const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY || '' });
                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: SYSTEM_INSTRUCTION,
                    },
                });
                setChatSession(chat);

                setIsLoading(true);
                const response = await chat.sendMessage({ message: 'Start the session.' });
                const botMsg: Message = { role: 'model', text: response.text || '', timestamp: new Date().toISOString() };
                setMessages([botMsg]);
                setTurnCount(1);

                // Save initial message to database
                if (newSessionId) {
                    await updateSession(newSessionId, [botMsg], 1);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error initializing chat:', error);
                setMessages([{ role: 'model', text: 'Error initializing TINA. Please check API Key.', timestamp: new Date().toISOString() }]);
            }
        };

        initChat();
    }, [user]);

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
                    setInput((prev) => (prev + ' ' + newTranscript).trim());
                }
            };

            recognition.onend = () => setIsRecording(false);
            recognition.onerror = () => setIsRecording(false);
            recognitionRef.current = recognition;
        }
    }, []);

    // Auto-scroll
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Save to Supabase when messages change
    useEffect(() => {
        if (sessionId && messages.length > 0) {
            updateSession(sessionId, messages, turnCount);
        }
    }, [messages, sessionId, turnCount]);

    const handleSend = async () => {
        if (!input.trim() || !chatSession || isLoading) return;

        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }

        const userMsg: Message = { role: 'user', text: input.trim(), timestamp: new Date().toISOString() };
        setInput('');
        setMessages((prev) => [...prev, userMsg]);
        setIsLoading(true);

        // Start turn tracking for analytics
        startTurnTracking();

        try {
            const response = await chatSession.sendMessage({ message: userMsg.text });
            const botMsg: Message = { role: 'model', text: response.text || '', timestamp: new Date().toISOString() };

            const newTurnCount = turnCount + 1;
            setTurnCount(newTurnCount);

            // Analyze this turn for affect-aware analytics
            if (sessionId) {
                try {
                    const turnAnalytics = await analyzeUserTurn(newTurnCount, userMsg.text);
                    await saveTurnAnalytics(sessionId, turnAnalytics);
                    console.log('Turn analytics saved:', turnAnalytics);
                } catch (analyticsErr) {
                    console.warn('Analytics failed (non-blocking):', analyticsErr);
                }
            }

            // Check if session should end (20 turns or any report variation detected)
            const reportPatterns = [
                'TINA Reflection Report',
                'Reflection Report',
                '**1) Teacher Identity',
                '**2) Core Values',
                'Integrated Insight',
                'Practical Next Step'
            ];
            const isReportTurn = reportPatterns.some(pattern => botMsg.text.includes(pattern)) || newTurnCount >= 20;

            if (isReportTurn && sessionId) {
                // Don't show report in chat - show completion message instead
                const completionMsg: Message = {
                    role: 'model',
                    text: '✨ Thank you for this meaningful conversation! Your personalized reflection report is ready.',
                    timestamp: new Date().toISOString()
                };
                const allMessages = [...messages, userMsg, completionMsg];
                setMessages(allMessages);

                // Save all messages to database before completing
                await updateSession(sessionId, [...messages, userMsg, botMsg], newTurnCount);

                // Extract keywords (simplified)
                const layer1Keywords = ['values', 'identity', 'role', 'teacher'];
                const layer2Keywords = ['AI', 'practice', 'tools', 'usage'];
                const layer3Keywords = ['society', 'ethics', 'fairness', 'policy'];

                // Classify teacher into cluster using NLP
                let clusterResult;
                try {
                    clusterResult = await classifyTeacherCluster([...messages, userMsg]);
                    console.log('Teacher cluster classification:', clusterResult);
                } catch (err) {
                    console.error('Cluster classification failed:', err);
                }

                await completeSession(sessionId, botMsg.text, {
                    layer1: layer1Keywords,
                    layer2: layer2Keywords,
                    layer3: layer3Keywords,
                }, clusterResult);

                // Save session analytics
                await saveSessionAnalytics(sessionId, 'completed');

                // Get completed session data and show modal immediately
                setTimeout(async () => {
                    const sessionData = await getSession(sessionId);
                    if (sessionData) {
                        setCompletedSession(sessionData);
                        setShowReportModal(true);
                    }
                }, 500);
            } else {
                // Normal message - add to chat and save to database
                const updatedMessages = [...messages, userMsg, botMsg];
                setMessages(updatedMessages);

                // Save messages to database after each turn
                if (sessionId) {
                    await updateSession(sessionId, updatedMessages, newTurnCount);
                }

                // Trigger Quick Reply questions at specific turns
                if (newTurnCount === 2 && !quickReplyResponses.ai_frequency) {
                    setTimeout(() => setCurrentQuickReply(QUICK_REPLY_QUESTIONS[0]), 500);
                } else if (newTurnCount === 4 && !quickReplyResponses.verification_level) {
                    setTimeout(() => setCurrentQuickReply(QUICK_REPLY_QUESTIONS[1]), 500);
                } else if (newTurnCount === 6 && !quickReplyResponses.main_concern) {
                    setTimeout(() => setCurrentQuickReply(QUICK_REPLY_QUESTIONS[2]), 500);
                }
            }
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages((prev) => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.', timestamp: new Date().toISOString() }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMicClick = () => {
        if (!recognitionRef.current) {
            alert('Voice input is not supported in this browser.');
            return;
        }

        if (isRecording) {
            recognitionRef.current.stop();
            setIsRecording(false);
        } else {
            try {
                recognitionRef.current.start();
                setIsRecording(true);
                // Track voice input usage for analytics
                markVoiceInputUsed();
            } catch (e) {
                setIsRecording(false);
            }
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleNewSession = () => {
        // Reset state and start new session
        setShowReportModal(false);
        setCompletedSession(null);
        setMessages([]);
        setTurnCount(0);
        setSessionId(null);
        setCurrentQuickReply(null);
        setQuickReplyResponses({});
        hasInitialized.current = false;
        window.location.reload();
    };

    // Handle quick reply selection
    const handleQuickReplySelect = async (questionId: string, optionId: string, optionLabel: string) => {
        // Save the response
        setQuickReplyResponses(prev => ({ ...prev, [questionId]: optionId }));

        // Clear current quick reply
        setCurrentQuickReply(null);

        // Send as a regular message
        setInput(optionLabel);

        // Small delay then send
        setTimeout(() => {
            const userMsg: Message = { role: 'user', text: optionLabel, timestamp: new Date().toISOString() };
            setMessages(prev => [...prev, userMsg]);
            setInput('');

            // Trigger the AI response
            if (chatSession) {
                setIsLoading(true);
                startTurnTracking();
                chatSession.sendMessage({ message: optionLabel }).then(async (response) => {
                    const botMsg: Message = { role: 'model', text: response.text || '', timestamp: new Date().toISOString() };
                    const newTurnCount = turnCount + 1;
                    setTurnCount(newTurnCount);
                    setMessages(prev => [...prev, botMsg]);

                    // Check if we should show next quick reply question
                    if (newTurnCount === 2 && !quickReplyResponses.ai_frequency) {
                        setCurrentQuickReply(QUICK_REPLY_QUESTIONS[0]); // AI frequency
                    } else if (newTurnCount === 4 && !quickReplyResponses.verification_level) {
                        setCurrentQuickReply(QUICK_REPLY_QUESTIONS[1]); // Verification level
                    } else if (newTurnCount === 6 && !quickReplyResponses.main_concern) {
                        setCurrentQuickReply(QUICK_REPLY_QUESTIONS[2]); // Main concern
                    }

                    setIsLoading(false);

                    if (sessionId) {
                        await updateSession(sessionId, [...messages, userMsg, botMsg], newTurnCount);
                    }
                }).catch((error) => {
                    console.error('Quick reply error:', error);
                    setIsLoading(false);
                });
            }
        }, 100);
    };

    return (
        <>
            <div className="chat-container">
                <ProgressBar currentTurn={turnCount} totalTurns={8} />
                <div className="chat-messages">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`message-wrapper ${msg.role === 'user' ? 'message-wrapper-user' : 'message-wrapper-model'}`}
                        >
                            {msg.role === 'model' && (
                                <img
                                    src="/tina-avatar.png"
                                    alt="TINA"
                                    className="message-avatar"
                                />
                            )}
                            <div className={`message ${msg.role === 'user' ? 'message-user' : 'message-model'}`}>
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="message-wrapper message-wrapper-model">
                            <img src="/tina-avatar.png" alt="TINA" className="message-avatar" />
                            <div className="chat-loading">
                                <span className="dot">●</span> TINA is thinking...
                            </div>
                        </div>
                    )}

                    {/* Quick Reply Buttons */}
                    {currentQuickReply && !isLoading && (
                        <QuickReply
                            question={currentQuickReply}
                            onSelect={handleQuickReplySelect}
                            disabled={isLoading}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-container">
                    <button
                        className={`mic-button ${isRecording ? 'recording' : ''}`}
                        onClick={handleMicClick}
                        title={isRecording ? 'Stop Recording' : 'Start Voice Input'}
                    >
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                        </svg>
                    </button>
                    <input
                        type="text"
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRecording ? 'Listening...' : 'Share your thoughts...'}
                        disabled={isLoading}
                    />
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={isLoading || !input.trim()}
                    >
                        SEND
                    </button>
                </div>
            </div>

            {showReportModal && completedSession && (
                <ReportModal
                    session={completedSession}
                    onClose={() => setShowReportModal(false)}
                    onNewSession={handleNewSession}
                />
            )}
        </>
    );
}
