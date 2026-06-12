import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { hasSupabaseConfig } from '../lib/supabase';

export function Login() {
    const navigate = useNavigate();
    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgot, setIsForgot] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showStory, setShowStory] = useState(false);
    const [resetSent, setResetSent] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [resetBusy, setResetBusy] = useState(false);
    const { signIn, signUp, requestPasswordReset, loading, error } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = isSignUp
            ? await signUp(email, password)
            : await signIn(email, password);

        if (success) {
            navigate('/');
        }
    };

    const handleForgot = async (e: React.FormEvent) => {
        e.preventDefault();
        setResetBusy(true);
        setResetError(null);
        const { ok, error: err } = await requestPasswordReset(email);
        setResetBusy(false);
        // Don't reveal whether an email exists — always show the same confirmation.
        if (ok || /rate|limit/i.test(err || '')) setResetSent(true);
        else setResetError(err);
    };

    const backToSignIn = () => {
        setIsForgot(false);
        setIsSignUp(false);
        setResetSent(false);
        setResetError(null);
    };

    const openForgot = () => {
        setIsForgot(true);
        setIsSignUp(false);
        setResetSent(false);
        setResetError(null);
    };

    return (
        <div className="login-container">
            <div className="landing-hero">
                {/* Cartoon TINA campus loop behind the hero. Muted autoplay loop;
                    a static keyframe replaces it under prefers-reduced-motion. */}
                <video
                    className="hero-bg-video"
                    autoPlay
                    muted
                    loop
                    playsInline
                    poster="/video/tina-campus-keyframe.png"
                    aria-hidden="true"
                >
                    <source src="/video/tina-campus-thinking.mp4" type="video/mp4" />
                </video>
                <img className="hero-bg-fallback" src="/video/tina-campus-keyframe.png" alt="" aria-hidden="true" />
                <div className="hero-bg-overlay" aria-hidden="true" />

                <div className="landing-content">
                    <div className="landing-badge">AI-Guided Reflection</div>
                    <h1 className="landing-title">TINA</h1>
                    <p className="landing-subtitle">Teacher Identity Navigation Assistant</p>
                    <p className="landing-description">
                        A short guided conversation for preservice and practicing teachers to reflect on values,
                        AI use, and what to try next.
                    </p>

                    <button type="button" className="hero-story-btn" onClick={() => setShowStory(true)}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                        Watch TINA&apos;s story
                    </button>

                    <div className="landing-features">
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #5DADE2 0%, #85C1E9 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Guided Reflection</strong>
                                <p>Talk through what feels important, difficult, or unfinished in your teaching context.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #F4D03F 0%, #F39C12 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Actionable Debrief</strong>
                                <p>Leave with a concise summary, a next move, and questions to carry forward.</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #58D68D 0%, #2ECC71 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 12.18L5.5 12 12 8.18 18.5 12 12 15.18zM5 14.5v4L12 22l7-3.5v-4L12 18l-7-3.5z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Growth Over Labels</strong>
                                <p>Use TINA as a coaching tool, not a grading or ranking system.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="login-card">
                <div className="login-logo">
                    <img
                        src="/tina-mascot.png"
                        alt="TINA Mascot"
                        className="login-mascot"
                        width="160"
                        height="160"
                    />
                    <h2>{isForgot ? 'Reset your password' : 'Welcome back'}</h2>
                    <p>
                        {isForgot
                            ? "No worries. Enter your email and TINA will send you a link to set a new password."
                            : 'Start a guided reflection in just a few minutes.'}
                    </p>
                </div>

                {isForgot ? (
                    resetSent ? (
                        <div className="login-form">
                            <div className="reset-sent-card">
                                <strong>Check your email</strong>
                                <p>If an account exists for <em>{email}</em>, a reset link is on its way. It expires in about an hour.</p>
                            </div>
                        </div>
                    ) : (
                        <form className="login-form" onSubmit={handleForgot}>
                            {!hasSupabaseConfig && (
                                <div className="error-message">
                                    Missing Supabase environment variables. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local `.env.local` file.
                                </div>
                            )}
                            {resetError && <div className="error-message">{resetError}</div>}
                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={resetBusy || !hasSupabaseConfig}>
                                {resetBusy ? 'Sending…' : 'Send reset link'}
                            </button>
                        </form>
                    )
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        {!hasSupabaseConfig && (
                            <div className="error-message">
                                Missing Supabase environment variables. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your local `.env.local` file.
                            </div>
                        )}

                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <div className="form-label-row">
                                <label htmlFor="password">Password</label>
                                {!isSignUp && (
                                    <button type="button" className="forgot-link" onClick={openForgot}>
                                        Forgot password?
                                    </button>
                                )}
                            </div>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                required
                                minLength={6}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !hasSupabaseConfig}
                        >
                            {loading ? 'Loading…' : (isSignUp ? 'Sign Up' : 'Sign In')}
                        </button>
                    </form>
                )}

                {!isForgot && !isSignUp && (
                    <button type="button" className="btn btn-ghost reset-cta" onClick={openForgot}>
                        🔑 Reset or recover your password
                    </button>
                )}

                <div className="login-toggle">
                    {isForgot ? (
                        <button type="button" onClick={backToSignIn}>Back to sign in</button>
                    ) : isSignUp ? (
                        <>
                            Already have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(false)}>Sign In</button>
                        </>
                    ) : (
                        <>
                            Need an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(true)}>Sign Up</button>
                        </>
                    )}
                </div>
            </div>

            {showStory && (
                <div className="story-overlay" onClick={() => setShowStory(false)}>
                    <div className="story-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="story-close" onClick={() => setShowStory(false)} aria-label="Close video">×</button>
                        <video
                            className="story-video"
                            src="/video/tina-story-narrated.mp4"
                            poster="/video/tina-campus-keyframe.png"
                            controls
                            autoPlay
                            playsInline
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
