import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function Navbar() {
    const { user, signOut, isAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
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
                        {location.pathname !== '/admin' && (
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                onClick={() => navigate('/admin')}
                            >
                                📊 Dashboard
                            </button>
                        )}
                        {location.pathname === '/admin' && (
                            <button
                                className="btn btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                                onClick={() => navigate('/')}
                            >
                                💬 New Session
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
                        💬 New Session
                    </button>
                )}

                {location.pathname !== '/account' && (
                    <button
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        onClick={() => navigate('/account')}
                    >
                        👤 My Account
                    </button>
                )}

                <div className="navbar-user">
                    <span>{user.email}</span>
                    <span className="role-badge">{user.role}</span>
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
