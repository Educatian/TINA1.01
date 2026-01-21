import React from 'react';

export interface QuickReplyOption {
    id: string;
    label: string;
    emoji?: string;
}

export interface QuickReplyQuestion {
    id: string;
    questionText: string;
    options: QuickReplyOption[];
    keywords: string[]; // Keywords to detect in TINA's response
}

// Pre-defined quick reply questions for research
export const QUICK_REPLY_QUESTIONS: QuickReplyQuestion[] = [
    {
        id: 'ai_frequency',
        questionText: 'How often do you use AI in your teaching?',
        keywords: ['how often', 'frequency', 'how frequently', 'how much do you use', 'regularly', 'daily use', 'weekly use'],
        options: [
            { id: 'daily', label: 'Daily', emoji: '📅' },
            { id: 'weekly', label: '2-3 times/week', emoji: '📊' },
            { id: 'monthly', label: '1-2 times/month', emoji: '📆' },
            { id: 'rarely', label: 'Rarely or never', emoji: '🔍' }
        ]
    },
    {
        id: 'verification_level',
        questionText: 'How do you review AI-generated content before using it?',
        keywords: ['verify', 'review', 'check', 'fact-check', 'edit', 'modify', 'validate', 'how do you ensure', 'before using'],
        options: [
            { id: 'as_is', label: 'Use as-is', emoji: '✅' },
            { id: 'light_edit', label: 'Light editing', emoji: '✏️' },
            { id: 'thorough', label: 'Thorough review', emoji: '🔎' },
            { id: 'reference_only', label: 'Reference only', emoji: '📝' }
        ]
    },
    {
        id: 'main_concern',
        questionText: 'What is your biggest concern about AI in education?',
        keywords: ['concern', 'worry', 'worried', 'anxious', 'fear', 'challenge', 'risk', 'problem', 'issue', 'downside'],
        options: [
            { id: 'learning_impact', label: 'Student learning', emoji: '📚' },
            { id: 'equity', label: 'Equity & fairness', emoji: '⚖️' },
            { id: 'accuracy', label: 'Information accuracy', emoji: '🎯' },
            { id: 'no_concern', label: 'No major concerns', emoji: '👍' }
        ]
    },
    {
        id: 'ai_purpose',
        questionText: 'What do you mainly use AI for?',
        keywords: ['what kind', 'what type', 'which task', 'what purpose', 'use ai for', 'helpful for', 'most helpful', 'mainly use'],
        options: [
            { id: 'lesson_planning', label: 'Lesson planning', emoji: '📝' },
            { id: 'content_creation', label: 'Content creation', emoji: '✍️' },
            { id: 'feedback_grading', label: 'Feedback & grading', emoji: '📋' },
            { id: 'research_ideas', label: 'Research & ideas', emoji: '💡' }
        ]
    },
    {
        id: 'ai_impact',
        questionText: 'How has AI impacted your teaching?',
        keywords: ['impact', 'change', 'difference', 'affect', 'influence', 'benefit', 'help you', 'improve', 'efficiency'],
        options: [
            { id: 'saves_time', label: 'Saves time', emoji: '⏰' },
            { id: 'better_quality', label: 'Better quality', emoji: '⭐' },
            { id: 'more_creative', label: 'More creative', emoji: '🎨' },
            { id: 'mixed_feelings', label: 'Mixed feelings', emoji: '🤔' }
        ]
    }
];

// Function to detect matching quick reply based on TINA's response
export function detectQuickReply(tinaResponse: string, answeredQuestions: string[]): QuickReplyQuestion | null {
    const lowerResponse = tinaResponse.toLowerCase();

    for (const question of QUICK_REPLY_QUESTIONS) {
        // Skip if already answered
        if (answeredQuestions.includes(question.id)) {
            continue;
        }

        // Check if any keyword matches
        const hasMatch = question.keywords.some(keyword =>
            lowerResponse.includes(keyword.toLowerCase())
        );

        if (hasMatch) {
            return question;
        }
    }

    return null;
}

interface QuickReplyProps {
    question: QuickReplyQuestion;
    onSelect: (questionId: string, optionId: string, optionLabel: string) => void;
    disabled?: boolean;
}

export function QuickReply({ question, onSelect, disabled }: QuickReplyProps) {
    return (
        <div className="quick-reply-container">
            <div className="quick-reply-buttons">
                {question.options.map((option) => (
                    <button
                        key={option.id}
                        className="quick-reply-button"
                        onClick={() => onSelect(question.id, option.id, option.label)}
                        disabled={disabled}
                    >
                        {option.emoji && <span className="quick-reply-emoji">{option.emoji}</span>}
                        <span className="quick-reply-label">{option.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
