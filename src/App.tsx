import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { ChatInterface } from './components/ChatInterface';
import { Certificate } from './components/Certificate';
import { AdminDashboard } from './components/AdminDashboard';
import { MyAccount } from './components/MyAccount';
import { Navbar } from './components/Navbar';
import './index.css';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
    const { user, loading, isAdmin } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
}

function ChatPage() {
    const navigate = useNavigate();

    const handleSessionComplete = (sessionId: string) => {
        navigate(`/certificate/${sessionId}`);
    };

    return (
        <div className="app-container">
            <Navbar />
            <ChatInterface onSessionComplete={handleSessionComplete} />
        </div>
    );
}

function AdminPage() {
    return (
        <div className="app-container" style={{ maxWidth: '1200px' }}>
            <Navbar />
            <AdminDashboard />
        </div>
    );
}

function AccountPage() {
    return (
        <div className="app-container" style={{ maxWidth: '900px' }}>
            <Navbar />
            <MyAccount />
        </div>
    );
}

function App() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Loading...</p>
            </div>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route
                    path="/login"
                    element={user ? <Navigate to="/" replace /> : <Login />}
                />
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <ChatPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/account"
                    element={
                        <ProtectedRoute>
                            <AccountPage />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/certificate/:sessionId"
                    element={
                        <ProtectedRoute>
                            <Certificate />
                        </ProtectedRoute>
                    }
                />
                <Route
                    path="/admin"
                    element={
                        <ProtectedRoute adminOnly>
                            <AdminPage />
                        </ProtectedRoute>
                    }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
