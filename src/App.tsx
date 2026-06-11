import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { Login } from './components/Login';
import { ChatInterface } from './components/ChatInterface';
import { Navbar } from './components/Navbar';
import './index.css';

// Route-level code splitting: the admin dashboard (~80KB) and the rarely-hit
// certificate/account pages load on demand instead of bloating the first
// paint of the learner chat — the only path most users ever take.
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const Certificate = lazy(() => import('./components/Certificate').then((m) => ({ default: m.Certificate })));
const MyAccount = lazy(() => import('./components/MyAccount').then((m) => ({ default: m.MyAccount })));

function RouteFallback() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
            <p>Loading...</p>
        </div>
    );
}

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
            <Suspense fallback={<RouteFallback />}>
                <AdminDashboard />
            </Suspense>
        </div>
    );
}

function AccountPage() {
    return (
        <div className="app-container" style={{ maxWidth: '900px' }}>
            <Navbar />
            <Suspense fallback={<RouteFallback />}>
                <MyAccount />
            </Suspense>
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
                            <Suspense fallback={<RouteFallback />}>
                                <Certificate />
                            </Suspense>
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
