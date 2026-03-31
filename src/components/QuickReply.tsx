import React from 'react';
import type { LearnerLevel } from '../types';
import { isPreserviceLearnerLevel } from '../services/activityConfig';

export interface QuickReplyOption {
    id: string;
    label: string;
    emoji?: string;
}

export interface QuickReplyQuestion {
    id: string;
    questionText: string;
    options: QuickReplyOption[];
    keywords: string[];
}

const GENERAL_QUICK_REPLY_QUESTIONS: QuickReplyQuestion[] = [
    {
        id: 'ai_frequency',
        questionText: 'How often do you use AI in your teaching?',
        keywords: ['how often', 'frequency', 'how frequently', 'how much do you use', 'regularly', 'daily use', 'weekly use'],
        options: [
            { id: 'daily', label: 'Daily', emoji: 'Daily' },
            { id: 'weekly', label: '2-3 times/week', emoji: 'Weekly' },
            { id: 'monthly', label: '1-2 times/month', emoji: 'Monthly' },
            { id: 'rarely', label: 'Rarely or never', emoji: 'Rarely' }
        ]
    },
    {
        id: 'verification_level',
        questionText: 'How do you review AI-generated content before using it?',
        keywords: ['verify', 'review', 'check', 'fact-check', 'edit', 'modify', 'validate', 'how do you ensure', 'before using'],
        options: [
            { id: 'as_is', label: 'Use as-is', emoji: 'Fast' },
            { id: 'light_edit', label: 'Light editing', emoji: 'Edit' },
            { id: 'thorough', label: 'Thorough review', emoji: 'Review' },
            { id: 'reference_only', label: 'Reference only', emoji: 'Reference' }
        ]
    },
    {
        id: 'main_concern',
        questionText: 'What is your biggest concern about AI in education?',
        keywords: ['concern', 'worry', 'worried', 'anxious', 'fear', 'challenge', 'risk', 'problem', 'issue', 'downside'],
        options: [
            { id: 'learning_impact', label: 'Student learning', emoji: 'Learning' },
            { id: 'equity', label: 'Equity & fairness', emoji: 'Equity' },
            { id: 'accuracy', label: 'Information accuracy', emoji: 'Accuracy' },
            { id: 'no_concern', label: 'No major concerns', emoji: 'Okay' }
        ]
    },
];

const PRESERVICE_QUICK_REPLY_QUESTIONS: QuickReplyQuestion[] = [
    {
        id: 'ai_coursework_use',
        questionText: 'Where do you use AI most right now?',
        keywords: ['where do you use', 'what do you mainly use ai for', 'what do you use ai for', 'most often', 'mainly use'],
        options: [
            { id: 'lesson_planning', label: 'Lesson planning', emoji: 'Plan' },
            { id: 'coursework', label: 'Coursework ideas', emoji: 'Ideas' },
            { id: 'feedback_revision', label: 'Revision & feedback', emoji: 'Revise' },
            { id: 'rarely', label: 'I barely use it', emoji: 'New' }
        ]
    },
    {
        id: 'preservice_confidence',
        questionText: 'Where do you feel least confident?',
        keywords: ['least confident', 'what feels hardest', 'what feels most difficult', 'what feels uncertain', 'what feels unclear', 'what feels most challenging'],
        options: [
            { id: 'tool_choice', label: 'Choosing the right tool', emoji: 'Tools' },
            { id: 'verification', label: 'Checking accuracy', emoji: 'Check' },
            { id: 'ethics', label: 'Using it ethically', emoji: 'Ethics' },
            { id: 'classroom_fit', label: 'Fitting it to class', emoji: 'Fit' }
        ]
    },
    {
        id: 'practicum_context',
        questionText: 'What kind of context are you thinking about?',
        keywords: ['what situation', 'what context', 'what kind of class', 'what kind of setting', 'practicum', 'future classroom', 'teaching situation'],
        options: [
            { id: 'microteaching', label: 'Microteaching', emoji: 'Micro' },
            { id: 'practicum', label: 'Practicum prep', emoji: 'Practicum' },
            { id: 'assignment', label: 'Course assignment', emoji: 'Course' },
            { id: 'future_classroom', label: 'Future classroom', emoji: 'Future' }
        ]
    },
    {
        id: 'trust_level',
        questionText: 'How much do you trust AI output at first glance?',
        keywords: ['how much do you trust', 'how much do you rely', 'how much do you believe', 'trust ai', 'trust the output'],
        options: [
            { id: 'high', label: 'I trust it a lot', emoji: 'High' },
            { id: 'medium', label: 'I trust it somewhat', emoji: 'Medium' },
            { id: 'low', label: 'I double-check most of it', emoji: 'Check' },
            { id: 'unsure', label: 'I am not sure yet', emoji: 'Unsure' }
        ]
    },
];

export function getQuickReplyQuestions(learnerLevel?: LearnerLevel) {
    return learnerLevel && isPreserviceLearnerLevel(learnerLevel)
        ? PRESERVICE_QUICK_REPLY_QUESTIONS
        : GENERAL_QUICK_REPLY_QUESTIONS;
}

export function detectQuickReply(
    tinaResponse: string,
    answeredQuestions: string[],
    learnerLevel?: LearnerLevel,
): QuickReplyQuestion | null {
    const lowerResponse = tinaResponse.toLowerCase();
    const questionBank = getQuickReplyQuestions(learnerLevel);

    for (const question of questionBank) {
        if (answeredQuestions.includes(question.id)) {
            continue;
        }

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
            <p className="quick-reply-question">{question.questionText}</p>
            <div className="quick-reply-buttons">
                {question.options.map((option) => (
                    <button
                        key={option.id}
                        className="quick-reply-button"
                        onClick={() => onSelect(question.id, option.id, option.label)}
                        disabled={disabled}
                    >
                        <span className="quick-reply-label">{option.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
