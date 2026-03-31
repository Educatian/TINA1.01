import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isLearnerPreviewEnabled, ROLE_PREVIEW_EVENT, setRolePreview } from '../services/rolePreview';

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
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                            onClick={handleTogglePreview}
                        >
                            {isLearnerPreview ? 'Instructor Mode' : 'Learner Test Mode'}
                        </button>
                        {location.pathname !== '/admin' && (
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                onClick={() => navigate('/admin')}
                            >
                                Dashboard
                            </button>
                        )}
                        {location.pathname === '/admin' && (
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                onClick={() => navigate('/')}
                            >
                                New Session
                            </button>
                        )}
                    </>
                )}

                {location.pathname !== '/' && (
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        onClick={() => navigate('/')}
                    >
                        New Session
                    </button>
                )}

                {location.pathname !== '/account' && (
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
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
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    onClick={handleSignOut}
                >
                    Sign Out
                </button>
            </div>
        </nav>
    );
}
