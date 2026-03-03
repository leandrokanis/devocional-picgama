import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import axios from 'axios';

const AUTH_STORAGE_KEY = 'devocional_auth_token';

const readToken = () => localStorage.getItem(AUTH_STORAGE_KEY)?.trim() ?? '';

type ApiContextValue = {
  token: string;
  isAuthenticated: boolean;
  login: (user: string, password: string) => Promise<void>;
  logout: () => void;
  api: ReturnType<typeof axios.create>;
};

const ApiContext = createContext<ApiContextValue | null>(null);

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string>(readToken());

  const persistToken = useCallback((value: string) => {
    const normalized = value.trim();
    if (!normalized) localStorage.removeItem(AUTH_STORAGE_KEY);
    else localStorage.setItem(AUTH_STORAGE_KEY, normalized);
    setToken(normalized);
  }, []);

  const logout = useCallback(() => {
    persistToken('');
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }, [persistToken]);

  const login = useCallback(async (user: string, password: string) => {
    const response = await axios.post<{ success: boolean; token?: string; error?: string }>(
      '/api/auth/login',
      { user, password },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const authToken = response.data.token?.trim() ?? '';
    if (!authToken) throw new Error(response.data.error || 'Failed to authenticate');
    persistToken(authToken);
  }, [persistToken]);

  const api = useMemo(() => {
    const client = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    client.interceptors.request.use((config) => {
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error?.response?.status === 401) logout();
        return Promise.reject(error);
      }
    );
    return client;
  }, [logout, token]);

  return (
    <ApiContext.Provider value={{ token, isAuthenticated: Boolean(token), login, logout, api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used inside ApiProvider');
  return context;
}
