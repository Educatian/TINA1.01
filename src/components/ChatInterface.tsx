import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GoogleGenAI, Chat } from '@google/genai';
import { useAuth } from '../hooks/useAuth';
import { createSession, updateSession, completeSession, getSession, upsertSessionOutput } from '../hooks/useSession';
import { classifyTeacherCluster } from '../services/nlpService';
import {
    initSessionTracking,
    startTurnTracking,
    getTurnResponseTime,
    analyzeUserTurn,
    saveTurnAnalytics,
    saveSessionAnalytics,
    markVoiceInputUsed
} from '../services/analyticsService';
import {
    buildActivitySystemInstruction,
    listAssignedLearnerActivities,
    loadActivityConfig,
    resolveActivityForChat,
    setActiveActivityRecord,
    updateEnrollmentStatus,
} from '../services/activityConfig';
import { ReportModal } from './ReportModal';
import { QuickReply, QuickReplyQuestion, detectQuickReply } from './QuickReply';
import { ProgressBar } from './ProgressBar';
import { ActivityContextHeader } from './ActivityContextHeader';
import type { ActivityConfig, ActivityRecord, Message, Session } from '../types';

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

**CRITICAL RULE: ONE QUESTION PER RESPONSE**
- NEVER ask multiple questions in one response.
- If you want to ask about two topics, pick the most important one.
- Bad example: "What tools do you use? And how do you verify them?"
- Good example: "What tools do you use most often?"
- Wait for the user's answer before asking another question.

If user answer is very short, you may ask ONE gentle follow-up (e.g., "Could you tell me more about that?").

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

const MAX_TURNS = 12;

interface ChatInterfaceProps {
    onSessionComplete: (sessionId: string) => void;
}

export function ChatInterface({ onSessionComplete }: ChatInterfaceProps) {
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [activityConfig, setActivityConfig] = useState<ActivityConfig>(() => loadActivityConfig());
    const [resolvedActivityId, setResolvedActivityId] = useState<string | null>(null);
    const [learnerActivities, setLearnerActivities] = useState<ActivityRecord[]>([]);
    const [selectedLearnerActivityId, setSelectedLearnerActivityId] = useState<string>('');
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
    const [queuedCount, setQueuedCount] = useState(0);
    const isProcessingRef = useRef(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);
    const hasInitialized = useRef(false);
    const messagesRef = useRef<Message[]>([]);
    const turnCountRef = useRef(0);
    const sessionIdRef = useRef<string | null>(null);
    const quickReplyResponsesRef = useRef<Record<string, string>>({});
    const queuedMessagesRef = useRef<string[]>([]);

    // Check for resume session from navigation state
    const resumeSession = (location.state as any)?.resumeSession as Session | undefined;

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    useEffect(() => {
        turnCountRef.current = turnCount;
    }, [turnCount]);

    useEffect(() => {
        sessionIdRef.current = sessionId;
    }, [sessionId]);

    useEffect(() => {
        quickReplyResponsesRef.current = quickReplyResponses;
    }, [quickReplyResponses]);

    useEffect(() => {
        const syncActivityConfig = () => {
            setActivityConfig(loadActivityConfig());
        };

        window.addEventListener('storage', syncActivityConfig);
        window.addEventListener('activity-config-updated', syncActivityConfig as EventListener);

        return () => {
            window.removeEventListener('storage', syncActivityConfig);
            window.removeEventListener('activity-config-updated', syncActivityConfig as EventListener);
        };
    }, []);

    useEffect(() => {
        if (!user || isAdmin) {
            setLearnerActivities([]);
            return;
        }

        const loadLearnerActivities = async () => {
            const activities = await listAssignedLearnerActivities(user.id);
            setLearnerActivities(activities);
            if (activities.length > 0) {
                setSelectedLearnerActivityId(prev => prev || activities[0].id);
            } else {
                setSelectedLearnerActivityId('');
            }
        };

        void loadLearnerActivities();
    }, [user, isAdmin]);

    // Initialize Chat Session
    useEffect(() => {
        if (hasInitialized.current || !user) return;
        hasInitialized.current = true;

        const initChat = async () => {
            try {
                const currentActivityRecord = await resolveActivityForChat({
                    userId: user.id,
                    isInstructor: isAdmin,
                    preferredActivityId: resumeSession?.activity_id || undefined,
                });
                const currentActivityConfig = currentActivityRecord || loadActivityConfig();
                setActivityConfig(currentActivityConfig);
                setResolvedActivityId(currentActivityRecord?.id || null);
                if (currentActivityRecord?.id) {
                    setSelectedLearnerActivityId(currentActivityRecord.id);
                }

                if (!isAdmin && !currentActivityRecord) {
                    replaceMessages([{
                        role: 'model',
                        text: 'No activity has been assigned to your account yet. Please contact your instructor before starting a session.',
                        timestamp: new Date().toISOString(),
                    }]);
                    return;
                }

                // Check if resuming a session
                if (resumeSession) {
                    setSessionIdState(resumeSession.id);
                    const existingMessages = resumeSession.messages as Message[] || [];
                    replaceMessages(existingMessages);
                    setTurnCountState(resumeSession.turn_count || 0);

                    // Initialize AI with history context - use same API key access as new session
                    const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY || '';
                    if (!apiKey) {
                        replaceMessages([...existingMessages, {
                            role: 'model',
                            text: 'Error: API key not found. Please check your environment configuration.',
                            timestamp: new Date().toISOString()
                        }]);
                        return;
                    }

                    const ai = new GoogleGenAI({ apiKey });
                    const historyContext = existingMessages.map(m =>
                        `${m.role === 'user' ? 'User' : 'TINA'}: ${m.text}`
                    ).join('\n\n');

                    const chat = ai.chats.create({
                        model: 'gemini-2.5-flash',
                        config: {
                            systemInstruction: buildActivitySystemInstruction(
                                SYSTEM_INSTRUCTION,
                                currentActivityConfig,
                            ) + `\n\nPREVIOUS CONVERSATION CONTEXT:\n${historyContext}\n\nContinue the conversation naturally from where we left off.`,
                        },
                    });
                    setChatSession(chat);

                    // Re-initialize analytics tracking for resumed session
                    initSessionTracking();
                    startTurnTracking();

                    // Clear the navigation state
                    navigate('/', { replace: true, state: {} });
                    return;
                }

                // Create new session in Supabase
                const newSessionId = await createSession(user.id, currentActivityRecord?.id || null);
                if (newSessionId) {
                    setSessionIdState(newSessionId);
                    // Initialize analytics tracking
                    initSessionTracking();
                    if (!isAdmin && currentActivityRecord?.id) {
                        try {
                            await updateEnrollmentStatus(currentActivityRecord.id, user.id, 'started');
                        } catch (enrollmentError) {
                            console.warn('Enrollment start update failed:', enrollmentError);
                        }
                    }
                }

                const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.API_KEY || '' });
                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: {
                        systemInstruction: buildActivitySystemInstruction(
                            SYSTEM_INSTRUCTION,
                            currentActivityConfig,
                        ),
                    },
                });
                setChatSession(chat);

                setIsLoading(true);
                const response = await chat.sendMessage({ message: 'Start the session.' });
                const botMsg: Message = { role: 'model', text: response.text || '', timestamp: new Date().toISOString() };
                replaceMessages([botMsg]);
                setTurnCountState(1);
                startTurnTracking();

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
    }, [user, isAdmin]);

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

    const replaceMessages = (nextMessages: Message[]) => {
        messagesRef.current = nextMessages;
        setMessages(nextMessages);
    };

    const appendMessages = (...nextMessages: Message[]) => {
        const updatedMessages = [...messagesRef.current, ...nextMessages];
        messagesRef.current = updatedMessages;
        setMessages(updatedMessages);
        return updatedMessages;
    };

    const setTurnCountState = (nextTurnCount: number) => {
        turnCountRef.current = nextTurnCount;
        setTurnCount(nextTurnCount);
    };

    const setSessionIdState = (nextSessionId: string | null) => {
        sessionIdRef.current = nextSessionId;
        setSessionId(nextSessionId);
    };

    const setQuickReplyResponsesState = (updater: (prev: Record<string, string>) => Record<string, string>) => {
        const nextResponses = updater(quickReplyResponsesRef.current);
        quickReplyResponsesRef.current = nextResponses;
        setQuickReplyResponses(nextResponses);
    };

    // Save to Supabase when messages change
    useEffect(() => {
        if (sessionId && messages.length > 0) {
            updateSession(sessionId, messages, turnCount);
        }
    }, [messages, sessionId, turnCount]);

    const processNextQueuedMessage = () => {
        if (isProcessingRef.current) return;

        const nextMessage = queuedMessagesRef.current.shift();
        setQueuedCount(queuedMessagesRef.current.length);

        if (nextMessage) {
            void processUserMessage(nextMessage);
        }
    };

    const processUserMessage = async (userText: string) => {
        if (!chatSession) return;

        isProcessingRef.current = true;
        setIsLoading(true);
        setCurrentQuickReply(null);

        const userMsg: Message = {
            role: 'user',
            text: userText,
            timestamp: new Date().toISOString()
        };
        appendMessages(userMsg);

        const newTurnCount = turnCountRef.current + 1;
        const userResponseTimeMs = getTurnResponseTime();

        try {
            const response = await chatSession.sendMessage({ message: userMsg.text });
            const botMsg: Message = {
                role: 'model',
                text: response.text || '',
                timestamp: new Date().toISOString()
            };

            setTurnCountState(newTurnCount);

            if (sessionIdRef.current) {
                try {
                    const turnAnalytics = await analyzeUserTurn(newTurnCount, userMsg.text, userResponseTimeMs);
                    await saveTurnAnalytics(sessionIdRef.current, turnAnalytics);
                } catch (analyticsErr) {
                    console.warn('Analytics failed (non-blocking):', analyticsErr);
                }
            }

            const reportPatterns = [
                'TINA Reflection Report',
                'Reflection Report',
                '**1) Teacher Identity',
                '**2) Core Values',
                'Integrated Insight',
                'Practical Next Step'
            ];
            const isReportTurn = reportPatterns.some(pattern => botMsg.text.includes(pattern)) || newTurnCount >= MAX_TURNS;

            if (isReportTurn && sessionIdRef.current) {
                const persistedMessages = [...messagesRef.current, botMsg];
                const completionMsg: Message = {
                    role: 'model',
                    text: 'Thank you for this meaningful conversation. Your personalized reflection report is ready.',
                    timestamp: new Date().toISOString()
                };

                replaceMessages([...messagesRef.current, completionMsg]);

                await updateSession(sessionIdRef.current, persistedMessages, newTurnCount);

                const layer1Keywords = ['values', 'identity', 'role', 'teacher'];
                const layer2Keywords = ['AI', 'practice', 'tools', 'usage'];
                const layer3Keywords = ['society', 'ethics', 'fairness', 'policy'];

                let clusterResult;
                try {
                    clusterResult = await classifyTeacherCluster(persistedMessages);
                } catch (err) {
                    console.error('Cluster classification failed:', err);
                }

                await completeSession(sessionIdRef.current, botMsg.text, {
                    layer1: layer1Keywords,
                    layer2: layer2Keywords,
                    layer3: layer3Keywords,
                }, clusterResult);

                if (resolvedActivityId) {
                    await upsertSessionOutput({
                        sessionId: sessionIdRef.current,
                        activityId: resolvedActivityId,
                        userId: user.id,
                        outputFormat: activityConfig.outputFormat,
                        outputText: botMsg.text,
                    });

                    if (!isAdmin) {
                        try {
                            await updateEnrollmentStatus(resolvedActivityId, user.id, 'completed');
                        } catch (enrollmentError) {
                            console.warn('Enrollment completion update failed:', enrollmentError);
                        }
                    }
                }

                await saveSessionAnalytics(sessionIdRef.current, 'completed');

                const sessionData = await getSession(sessionIdRef.current);
                if (sessionData) {
                    setCompletedSession(sessionData);
                    setShowReportModal(true);
                }
            } else {
                const updatedMessages = appendMessages(botMsg);

                if (sessionIdRef.current) {
                    await updateSession(sessionIdRef.current, updatedMessages, newTurnCount);
                }

                const answeredQuestionIds = Object.keys(quickReplyResponsesRef.current);
                const matchedQuickReply = detectQuickReply(botMsg.text, answeredQuestionIds);
                setCurrentQuickReply(matchedQuickReply);
                startTurnTracking();
            }
        } catch (error) {
            console.error('Error sending message:', error);
            appendMessages({
                role: 'model',
                text: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date().toISOString()
            });
            startTurnTracking();
        } finally {
            setIsLoading(false);
            isProcessingRef.current = false;
            processNextQueuedMessage();
        }
    };

    const queueOrSendMessage = (userText: string) => {
        const trimmedText = userText.trim();
        if (!trimmedText || !chatSession) return;

        if (isProcessingRef.current) {
            queuedMessagesRef.current.push(trimmedText);
            setQueuedCount(queuedMessagesRef.current.length);
            return;
        }

        void processUserMessage(trimmedText);
    };

    const handleSend = async () => {
        if (!input.trim() || !chatSession) return;

        if (isRecording && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsRecording(false);
        }

        const userText = input.trim();
        setInput('');
        queueOrSendMessage(userText);
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
        replaceMessages([]);
        setTurnCountState(0);
        setSessionIdState(null);
        setCurrentQuickReply(null);
        setQuickReplyResponsesState(() => ({}));
        queuedMessagesRef.current = [];
        setQueuedCount(0);
        hasInitialized.current = false;
        window.location.reload();
    };

    const handleLearnerActivityChange = (nextActivityId: string) => {
        const nextActivity = learnerActivities.find(activity => activity.id === nextActivityId);
        if (!nextActivity) {
            return;
        }

        setSelectedLearnerActivityId(nextActivityId);
        setActiveActivityRecord(nextActivity);
        window.location.reload();
    };

    // Handle quick reply selection
    const handleQuickReplySelect = async (questionId: string, optionId: string, optionLabel: string) => {
        setQuickReplyResponsesState(prev => ({ ...prev, [questionId]: optionId }));
        setCurrentQuickReply(null);
        queueOrSendMessage(optionLabel);
    };

    const canInteract = Boolean(chatSession) && (isAdmin || learnerActivities.length > 0);

    return (
        <>
            <div className="chat-container">
                <div className="chat-context-shell">
                    {!isAdmin && learnerActivities.length > 0 && (
                        <div className="activity-selector-bar">
                            <label htmlFor="learner-activity-select">Current activity</label>
                            <select
                                id="learner-activity-select"
                                value={selectedLearnerActivityId}
                                onChange={(e) => handleLearnerActivityChange(e.target.value)}
                            >
                                {learnerActivities.map(activity => (
                                    <option key={activity.id} value={activity.id}>
                                        {activity.title} · {activity.moduleLabel}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    {!isAdmin && learnerActivities.length === 0 && (
                        <div className="activity-selector-empty">
                            No activity has been assigned to your account yet. Please contact your instructor.
                        </div>
                    )}
                    {(isAdmin || learnerActivities.length > 0) && (
                        <ActivityContextHeader config={activityConfig} />
                    )}
                    <ProgressBar currentTurn={turnCount} totalTurns={MAX_TURNS} />
                </div>

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
                        disabled={!canInteract}
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
                        disabled={!canInteract}
                        placeholder={
                            !canInteract
                                ? 'Waiting for an assigned activity...'
                                : isRecording
                                ? 'Listening...'
                                : isLoading
                                    ? (queuedCount > 0 ? `${queuedCount} queued message(s)...` : 'Type to queue your next message...')
                                    : 'Share your thoughts...'
                        }
                    />
                    <button
                        className="send-button"
                        onClick={handleSend}
                        disabled={!input.trim() || !canInteract}
                    >
                        {isLoading ? (queuedCount > 0 ? `QUEUE (${queuedCount})` : 'QUEUE') : 'SEND'}
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



