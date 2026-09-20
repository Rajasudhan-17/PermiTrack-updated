// Centralized API Client Layer for Permitrack React Application

const rawBaseUrl = (import.meta.env.VITE_API_BASE_URL || (import.meta.env as any).API_BASE_URL || '/api/v1').trim();
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const getApiToken = (): string | null => {
  return localStorage.getItem('permitrack_api_token');
};

export const getAuthenticatedUrl = (url: string): string => {
  const token = getApiToken();
  let fullUrl = url;
  if (!url.startsWith('http')) {
    if (url.startsWith('/api/v1')) {
      const originBase = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
      fullUrl = originBase ? `${originBase}${url}` : url;
    } else {
      fullUrl = `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }
  }
  if (!token) return fullUrl;
  const separator = fullUrl.includes('?') ? '&' : '?';
  return `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
};

export const setApiToken = (token: string): void => {
  localStorage.setItem('permitrack_api_token', token);
};

export const clearApiToken = (): void => {
  localStorage.removeItem('permitrack_api_token');
  localStorage.removeItem('permitrack_active_role');
};

export const getActiveRole = (): string | null => {
  return localStorage.getItem('permitrack_active_role');
};

export const setActiveRole = (role: string): void => {
  localStorage.setItem('permitrack_active_role', role);
};

export const clearActiveRole = (): void => {
  localStorage.removeItem('permitrack_active_role');
};

export async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getApiToken();
  const activeRole = getActiveRole();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['X-API-Token'] = token;
  }
  if (activeRole) {
    headers['X-Active-Role'] = activeRole;
  }

  let url: string;
  if (endpoint.startsWith('http')) {
    url = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (API_BASE_URL.endsWith('/api/v1') && cleanEndpoint.startsWith('/api/v1/')) {
      url = `${API_BASE_URL.replace(/\/api\/v1$/, '')}${cleanEndpoint}`;
    } else {
      url = `${API_BASE_URL}${cleanEndpoint}`;
    }
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      clearApiToken();
      const msg = data.message || (endpoint.includes('/login') ? 'Invalid username or password. Please verify your credentials and try again.' : 'Session expired. Please log in again.');
      throw new ApiError(401, msg, data);
    }

    if (!response.ok) {
      throw new ApiError(
        response.status,
        data.message || `Request failed with status ${response.status}`,
        data
      );
    }

    return data as T;
  } catch (err: any) {
    if (err instanceof ApiError) {
      throw err;
    }
    const isNetworkError = err.message === 'Failed to fetch' || err.name === 'TypeError';
    const errorMsg = isNetworkError 
      ? 'Backend service is starting up or unreachable. Please verify VITE_API_BASE_URL (HTTPS) and try again in 10-20 seconds.'
      : (err.message || 'Network error occurred. Please check your connection.');
    throw new ApiError(500, errorMsg);
  }
}

export const client = {
  get: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'GET', headers }),

  post: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: typeof FormData !== 'undefined' && body instanceof FormData ? body : JSON.stringify(body),
      headers,
    }),

  put: <T>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'PUT', body: JSON.stringify(body), headers }),

  delete: <T>(endpoint: string, headers?: Record<string, string>) =>
    request<T>(endpoint, { method: 'DELETE', headers }),
};
