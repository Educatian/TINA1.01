import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

/* ============================================================================
   ResetPassword — landing for the Supabase reset-password email link.

   Supabase redirects here with a recovery token in the URL hash; the supabase
   client (detectSessionInUrl) processes it and fires PASSWORD_RECOVERY, giving
   a short-lived session in which updateUser({ password }) is allowed. Styled to
   match the TINA login (Nanobanana yellow + mascot).
   ========================================================================== */

export function ResetPassword() {
    const navigate = useNavigate();
    const { updatePassword } = useAuth();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    useEffect(() => {
        // The recovery session arrives via the URL hash. If it's already there
        // (or the event fires), enable the form.
        supabase.auth.getSession().then(({ data }) => { if (data?.session) setReady(true); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' || session) setReady(true);
        });
        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 6) { setError('Use at least 6 characters.'); return; }
        if (password !== confirm) { setError('The two passwords do not match.'); return; }
        setBusy(true);
        setError(null);
        const { ok, error: err } = await updatePassword(password);
        setBusy(false);
        if (ok) setDone(true);
        else setError(err || 'Could not update your password. The link may have expired — request a new one.');
    };

    return (
        <div className="login-container">
            <div className="login-card login-card-centered">
                <div className="login-logo">
                    <img src="/tina-mascot.png" alt="TINA" className="login-mascot" width="140" height="140" />
                    <h2>{done ? 'All set' : 'Choose a new password'}</h2>
                    <p>
                        {done
                            ? 'Your password has been updated. You can sign in with it now.'
                            : 'Pick something you will remember. This sets the password for your TINA account.'}
                    </p>
                </div>

                {done ? (
                    <button className="btn btn-primary" onClick={() => navigate('/login')}>Go to sign in</button>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        {error && <div className="error-message">{error}</div>}
                        {!ready && (
                            <div className="reset-sent-card">
                                <p>Open this page from the link in your reset email. If you got here another way, request a new link from the sign-in page.</p>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="new-password">New password</label>
                            <input
                                id="new-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="At least 6 characters"
                                autoComplete="new-password"
                                required
                                minLength={6}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="confirm-password">Confirm password</label>
                            <input
                                id="confirm-password"
                                type="password"
                                value={confirm}
                                onChange={(e) => setConfirm(e.target.value)}
                                placeholder="Re-enter your new password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={busy || !ready}>
                            {busy ? 'Updating…' : 'Update password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
