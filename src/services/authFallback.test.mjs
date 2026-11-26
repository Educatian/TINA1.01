import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackUser, isOverrideAdminEmail } from './authFallback.ts';

test('ordinary account retains its identity and receives the user fallback', () => {
    const user = buildFallbackUser({ id: 'learner-1', email: 'learner@example.test', created_at: '2026-01-01' });
    assert.deepEqual(user, { id: 'learner-1', email: 'learner@example.test', created_at: '2026-01-01', role: 'user' });
});
test('missing email stays a user and receives a valid creation time', () => {
    const user = buildFallbackUser({ id: 'learner-2' });
    assert.equal(user.role, 'user');
    assert.equal(user.email, '');
    assert.ok(Number.isFinite(Date.parse(user.created_at)));
});
test('existing instructor allowlist is case insensitive and exact', () => {
    assert.equal(isOverrideAdminEmail('JEWOONG.MOON@GMAIL.COM'), true);
    assert.equal(buildFallbackUser({ id: 'teacher', email: 'jewoong.moon@gmail.com' }).role, 'admin');
    assert.equal(isOverrideAdminEmail('learner@example.test'), false);
    assert.equal(isOverrideAdminEmail(undefined), false);
});
