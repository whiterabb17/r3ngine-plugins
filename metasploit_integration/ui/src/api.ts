export function getCsrfToken(): string {
    return document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] ?? '';
}

export const getConsoleModules = async () => {
    const res = await fetchWithAuth('/api/plugins/metasploit_integration/tasks/console-modules/');
    return await res.json() as { success: boolean, modules?: any[], error?: string };
};

export const stopConsole = async () => {
    const res = await fetchWithAuth('/api/plugins/metasploit_integration/tasks/console-stop/', { method: 'POST' });
    return await res.json();
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
