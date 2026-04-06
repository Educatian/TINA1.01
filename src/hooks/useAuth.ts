import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clearRolePreview } from '../services/rolePreview';
import type { User, AuthState } from '../types';

const OVERRIDE_ADMIN_EMAILS = new Set(['jewoong.moon@gmail.com']);
const PROFILE_LOOKUP_TIMEOUT_MS = 3500;
const AUTH_BOOTSTRAP_TIMEOUT_MS = 5000;

function isOverrideAdminEmail(email: string | undefined) {
    return Boolean(email && OVERRIDE_ADMIN_EMAILS.has(email.toLowerCase()));
}

function buildFallbackUser(sessionUser: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: { role?: string };
}): User {
    const email = sessionUser.email || '';
    const metadataRole = sessionUser.user_metadata?.role === 'admin' ? 'admin' : 'user';
    const role = metadataRole !== 'admin' && isOverrideAdminEmail(email) ? 'admin' : metadataRole;

    return {
        id: sessionUser.id,
        email,
        role,
        created_at: sessionUser.created_at || new Date().toISOString(),
    };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
    return new Promise((resolve) => {
        const timeoutId = window.setTimeout(() => resolve(fallbackValue), timeoutMs);

        promise
            .then((value) => {
                window.clearTimeout(timeoutId);
                resolve(value);
            })
            .catch(() => {
                window.clearTimeout(timeoutId);
                resolve(fallbackValue);
            });
    });
}

async function buildUser(sessionUser: {
    id: string;
    email?: string;
    created_at?: string;
    user_metadata?: { role?: string };
}): Promise<User> {
    const fallbackUser = buildFallbackUser(sessionUser);
    let role: User['role'] = fallbackUser.role;
    let createdAt = fallbackUser.created_at;
    let email = fallbackUser.email;

    const profileResult = await withTimeout(
        supabase
            .from('profiles')
            .select('email, role, created_at')
            .eq('id', sessionUser.id)
            .maybeSingle(),
        PROFILE_LOOKUP_TIMEOUT_MS,
        { data: null, error: new Error('profile_lookup_timeout') },
    );

    if (profileResult.error) {
        console.warn('Profile lookup skipped or failed:', profileResult.error);
        return fallbackUser;
    }

    const profile = profileResult.data;

    if (profile?.role === 'admin' || profile?.role === 'user') {
        role = profile.role;
    }

    if (profile?.created_at) {
        createdAt = profile.created_at;
    }

    if (profile?.email) {
        email = profile.email;
    }

    if (role !== 'admin' && isOverrideAdminEmail(email)) {
        role = 'admin';
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
        let isMounted = true;

        const bootstrapTimeout = window.setTimeout(() => {
            if (!isMounted) return;

            setAuthState((prev) => (
                prev.loading
                    ? { ...prev, loading: false, error: prev.error ?? null }
                    : prev
            ));
        }, AUTH_BOOTSTRAP_TIMEOUT_MS);

        const applySessionUser = async (
            sessionUser: {
                id: string;
                email?: string;
                created_at?: string;
                user_metadata?: { role?: string };
            } | null,
        ) => {
            if (!isMounted) return;

            if (!sessionUser) {
                setAuthState({ user: null, loading: false, error: null });
                return;
            }

            const fallbackUser = buildFallbackUser(sessionUser);

            setAuthState({
                user: fallbackUser,
                loading: false,
                error: null,
            });

            const enrichedUser = await buildUser(sessionUser);

            if (!isMounted) return;

            setAuthState((prev) => {
                if (prev.user?.id !== fallbackUser.id) {
                    return prev;
                }

                return {
                    user: enrichedUser,
                    loading: false,
                    error: null,
                };
            });
        };

        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                await applySessionUser(session?.user ?? null);
            } catch (error) {
                console.error('Session check error:', error);
                if (!isMounted) return;
                setAuthState({ user: null, loading: false, error: null });
            }
        };

        void checkSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            await applySessionUser(session?.user ?? null);
        });

        return () => {
            isMounted = false;
            window.clearTimeout(bootstrapTimeout);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = useCallback(async (email: string, password: string) => {
        setAuthState(prev => ({ ...prev, loading: true, error: null }));

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            setAuthState(prev => ({ ...prev, loading: false, error: error.message }));
            return false;
        }

        if (data.user) {
            const fallbackUser = buildFallbackUser(data.user);
            setAuthState({
                user: fallbackUser,
                loading: false,
                error: null,
            });

            const enrichedUser = await buildUser(data.user);
            setAuthState({
                user: enrichedUser,
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
                role: isOverrideAdminEmail(email) ? 'admin' : 'user',
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

            const fallbackUser = buildFallbackUser({
                ...data.user,
                email,
                user_metadata: {
                    ...data.user.user_metadata,
                    role: profilePayload.role,
                },
            });

            setAuthState({
                user: fallbackUser,
                loading: false,
                error: null,
            });

            const enrichedUser = await buildUser({
                ...data.user,
                email,
                user_metadata: {
                    ...data.user.user_metadata,
                    role: profilePayload.role,
                },
            });

            setAuthState({
                user: enrichedUser,
                loading: false,
                error: null,
            });
        }

        return true;
    }, []);

    const signOut = useCallback(async () => {
        clearRolePreview();
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
