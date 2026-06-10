export function getCsrfToken(): string {
    return document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

export const getConsoleModules = async () => {
    const res = await api.get('/api/plugins/metasploit_integration/tasks/console-modules/');
    return res.data as { success: boolean, modules?: any[], error?: string };
};

export const stopConsole = async () => {
    const res = await api.post('/api/plugins/metasploit_integration/tasks/console-stop/');
    return res.data;
};

export async function fetchWithAuth(url: string, options?: RequestInit) {
    return fetch(url, {
        credentials: 'include',
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken(),
            ...(options?.headers || {}),
        }
    });
}
