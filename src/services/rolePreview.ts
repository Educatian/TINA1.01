export type ChatRolePreview = 'admin' | 'learner';

const ROLE_PREVIEW_KEY = 'tina.chatRolePreview';
export const ROLE_PREVIEW_EVENT = 'role-preview-updated';

function dispatchRolePreviewUpdated(role: ChatRolePreview) {
    if (typeof window === 'undefined') {
        return;
    }

    window.dispatchEvent(new CustomEvent(ROLE_PREVIEW_EVENT, { detail: role }));
}

export function getRolePreview(): ChatRolePreview {
    if (typeof window === 'undefined') {
        return 'admin';
    }

    return window.localStorage.getItem(ROLE_PREVIEW_KEY) === 'learner'
        ? 'learner'
        : 'admin';
}

export function isLearnerPreviewEnabled() {
    return getRolePreview() === 'learner';
}

export function setRolePreview(role: ChatRolePreview) {
    if (typeof window === 'undefined') {
        return;
    }

    if (role === 'admin') {
        window.localStorage.removeItem(ROLE_PREVIEW_KEY);
    } else {
        window.localStorage.setItem(ROLE_PREVIEW_KEY, role);
    }

    dispatchRolePreviewUpdated(role);
}

export function clearRolePreview() {
    setRolePreview('admin');
}
