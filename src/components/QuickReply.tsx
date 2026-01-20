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
}

// Pre-defined quick reply questions for research
export const QUICK_REPLY_QUESTIONS: QuickReplyQuestion[] = [
    {
        id: 'ai_frequency',
        questionText: 'How often do you use AI in your teaching?',
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
        options: [
            { id: 'learning_impact', label: 'Student learning', emoji: '📚' },
            { id: 'equity', label: 'Equity & fairness', emoji: '⚖️' },
            { id: 'accuracy', label: 'Information accuracy', emoji: '🎯' },
            { id: 'no_concern', label: 'No major concerns', emoji: '👍' }
        ]
    }
];

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
