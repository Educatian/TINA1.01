import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, AuthState } from '../types';

export function useAuth() {
    const [authState, setAuthState] = useState<AuthState>({
        user: null,
        loading: true,
        error: null,
    });

    useEffect(() => {
        // Simple session check without profile lookup
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    // Use user metadata for role (or default to 'user')
                    const role = (session.user.user_metadata?.role as string) || 'user';
                    setAuthState({
                        user: {
                            id: session.user.id,
                            email: session.user.email || '',
                            role: role === 'admin' ? 'admin' : 'user',
                            created_at: session.user.created_at || new Date().toISOString(),
                        },
                        loading: false,
                        error: null,
                    });
                } else {
                    setAuthState({ user: null, loading: false, error: null });
                }
            } catch (error) {
                console.error('Session check error:', error);
                setAuthState({ user: null, loading: false, error: null });
            }
        };

        checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const role = (session.user.user_metadata?.role as string) || 'user';
                setAuthState({
                    user: {
                        id: session.user.id,
                        email: session.user.email || '',
                        role: role === 'admin' ? 'admin' : 'user',
                        created_at: session.user.created_at || new Date().toISOString(),
                    },
                    loading: false,
                    error: null,
                });
            } else {
                setAuthState({ user: null, loading: false, error: null });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setAuthState(prev => ({ ...prev, loading: true, error: null }));

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
            return false;
        }

        if (data.user) {
            // Check if admin from email (simple approach)
            const isAdmin = email === 'admin@tina.com';
            setAuthState({
                user: {
                    id: data.user.id,
                    email: data.user.email || email,
                    role: isAdmin ? 'admin' : 'user',
                    created_at: new Date().toISOString(),
                },
                loading: false,
                error: null,
            });
        }

        return true;
    }, []);

    const signUp = useCallback(async (email: string, password: string) => {
        setAuthState(prev => ({ ...prev, loading: true, error: null }));

        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) {
            setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
            return false;
        }

        if (data.user) {
            // Try to create profile (don't fail if it doesn't work)
            try {
                await supabase.from('profiles').insert({
                    id: data.user.id,
                    email: email,
                    role: 'user',
                });
            } catch (e) {
                console.warn('Failed to create profile:', e);
            }

            setAuthState({
                user: {
                    id: data.user.id,
                    email: email,
                    role: 'user',
                    created_at: new Date().toISOString(),
                },
                loading: false,
                error: null,
            });
        }

        return true;
    }, []);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        setAuthState({ user: null, loading: false, error: null });
    }, []);

    return {
        ...authState,
        signIn,
        signUp,
        signOut,
        isAdmin: authState.user?.role === 'admin' || authState.user?.email === 'admin@tina.com',
    };
}
