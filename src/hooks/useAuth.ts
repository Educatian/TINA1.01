import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { User, AuthState } from '../types';

async function buildUser(sessionUser: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: { role?: string };
}): Promise<User> {
    let role: User['role'] = sessionUser.user_metadata?.role === 'admin' ? 'admin' : 'user';
    let createdAt = sessionUser.created_at || new Date().toISOString();
    let email = sessionUser.email || '';

    const { data: profile } = await supabase
        .from('profiles')
        .select('email, role, created_at')
        .eq('id', sessionUser.id)
        .maybeSingle();

    if (profile?.role === 'admin' || profile?.role === 'user') {
        role = profile.role;
    }

    if (profile?.created_at) {
        createdAt = profile.created_at;
    }

    if (profile?.email) {
        email = profile.email;
    }

    return {
        id: sessionUser.id,
        email,
        role,
        created_at: createdAt,
    };
}

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
                    setAuthState({
                        user: await buildUser(session.user),
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
                setAuthState({
                    user: await buildUser(session.user),
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
            setAuthState({
                user: await buildUser(data.user),
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
            const profilePayload = {
                id: data.user.id,
                email,
                role: 'user',
            };

            try {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(profilePayload, { onConflict: 'id' });

                if (profileError) {
                    console.warn('Failed to create profile:', profileError);
                }
            } catch (e) {
                console.warn('Failed to create profile:', e);
            }

            setAuthState({
                user: await buildUser(data.user),
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
        isAdmin: authState.user?.role === 'admin',
    };
}
