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
            <div className="login-card">
                <div className="login-logo">
                    <img
                        src="/tina-mascot.png"
                        alt="TINA Mascot"
                        className="login-mascot"
                    />
                    <h1>TINA</h1>
                    <p>Teacher Identity Navigation Assistant</p>
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
                            <button type="button" onClick={() => setIsSignUp(false)} disabled={false}>Sign In</button>
                        </>
                    ) : (
                        <>
                            Don't have an account?{' '}
                            <button type="button" onClick={() => setIsSignUp(true)} disabled={false}>Sign Up</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
