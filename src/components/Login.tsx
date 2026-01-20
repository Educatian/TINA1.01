import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Login() {
    const navigate = useNavigate();
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { signIn, signUp, loading, error } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let success = false;
        if (isSignUp) {
            success = await signUp(email, password);
        } else {
            success = await signIn(email, password);
        }
        if (success) {
            navigate('/');
        }
    };

    return (
        <div className="login-container">
            {/* Hero Section */}
            <div className="landing-hero">
                <div className="landing-content">
                    <div className="landing-badge">AI-Powered Reflection Tool</div>
                    <h1 className="landing-title">TINA</h1>
                    <p className="landing-subtitle">Teacher Identity Navigation Assistant</p>
                    <p className="landing-description">
                        A 10-minute AI-guided conversation to explore your teacher identity,
                        values, and how AI is shaping your practice.
                    </p>

                    <div className="landing-features">
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #5DADE2 0%, #85C1E9 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Reflective Dialogue</strong>
                                <p>Engage in meaningful conversation about your teaching practice</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #F4D03F 0%, #F39C12 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Personalized Report</strong>
                                <p>Receive a detailed reflection report with actionable insights</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon-box" style={{ background: 'linear-gradient(135deg, #58D68D 0%, #2ECC71 100%)' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                    <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zm0 12.18L5.5 12 12 8.18 18.5 12 12 15.18zM5 14.5v4L12 22l7-3.5v-4L12 18l-7-3.5z" />
                                </svg>
                            </div>
                            <div>
                                <strong>Teacher Profiling</strong>
                                <p>Discover your teacher type based on AI integration readiness</p>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Login Card */}
            <div className="login-card">
                <div className="login-logo">
                    <img
                        src="/tina-mascot.png"
                        alt="TINA Mascot"
                        className="login-mascot"
                    />
                    <h2>Welcome Back!</h2>
                    <p>Start your reflection journey</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>
                    {error && <div className="error-message">{error}</div>}

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="your@email.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Loading...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <div className="login-toggle">
                    {isSignUp ? (
                        <>
                            Already have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(false)}>Sign In</button>
                        </>
                    ) : (
                        <>
                            Don't have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(true)}>Sign Up</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

