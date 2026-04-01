import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isLearnerPreviewEnabled, ROLE_PREVIEW_EVENT, setRolePreview } from '../services/rolePreview';

function AdminDashboardIcon() {
    return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className="navbar-icon">
            <path
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zm2 1.5v4h4V7zm6 0v4h6V7zM6 13v5h4v-5zm6 0v5h6v-5z"
                fill="currentColor"
            />
        </svg>
    );
}

export function Navbar() {
    const { user, signOut, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLearnerPreview, setIsLearnerPreview] = useState(() => isLearnerPreviewEnabled());

    useEffect(() => {
        const syncPreviewRole = () => {
            setIsLearnerPreview(isLearnerPreviewEnabled());
        };

        window.addEventListener('storage', syncPreviewRole);
        window.addEventListener(ROLE_PREVIEW_EVENT, syncPreviewRole as EventListener);

        return () => {
            window.removeEventListener('storage', syncPreviewRole);
            window.removeEventListener(ROLE_PREVIEW_EVENT, syncPreviewRole as EventListener);
        };
    }, []);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleTogglePreview = () => {
        const nextIsLearnerPreview = !isLearnerPreview;
        setRolePreview(nextIsLearnerPreview ? 'learner' : 'admin');
        setIsLearnerPreview(nextIsLearnerPreview);
        navigate('/');
        window.location.reload();
    };

    if (!user) return null;

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <h1>TINA</h1>
                <span>Teacher Identity Navigation Assistant</span>
            </div>

            <div className="navbar-actions">
                {isAdmin && (
                    <>
                        <button
                            className="btn btn-secondary navbar-button"
                            onClick={handleTogglePreview}
                        >
                            {isLearnerPreview ? 'Instructor Mode' : 'Learner Test Mode'}
                        </button>
                        <button
                            className={`btn btn-secondary navbar-icon-button ${location.pathname === '/admin' ? 'is-active' : ''}`}
                            onClick={() => navigate('/admin')}
                            aria-label="Open admin dashboard"
                            title="Admin Dashboard"
                        >
                            <AdminDashboardIcon />
                        </button>
                        {location.pathname === '/admin' && (
                            <button
                                className="btn btn-secondary navbar-button"
                                onClick={() => navigate('/')}
                            >
                                New Session
                            </button>
                        )}
                    </>
                )}

                {location.pathname !== '/' && (
                    <button
                        className="btn btn-secondary navbar-button"
                        onClick={() => navigate('/')}
                    >
                        New Session
                    </button>
                )}

                {location.pathname !== '/account' && (
                    <button
                        className="btn btn-secondary navbar-button"
                        onClick={() => navigate('/account')}
                    >
                        My Account
                    </button>
                )}

                <div className="navbar-user">
                    <span>{user.email}</span>
                    <span className="role-badge">{isLearnerPreview ? 'learner-preview' : user.role}</span>
                </div>

                <button
                    className="btn btn-secondary navbar-button"
                    onClick={handleSignOut}
                >
                    Sign Out
                </button>
            </div>
        </nav>
    );
}
