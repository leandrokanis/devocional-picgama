import { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';

type ApiContextValue = {
  token: string;
  api: ReturnType<typeof axios.create>;
};

const ApiContext = createContext<ApiContextValue | null>(null);

declare const __AUTH_TOKEN__: string | undefined;
declare global {
  interface Window {
    __AUTH_TOKEN__?: string;
  }
}

const envToken =
  (typeof window !== 'undefined' && window.__AUTH_TOKEN__?.trim()) ||
  (typeof __AUTH_TOKEN__ !== 'undefined' && __AUTH_TOKEN__?.trim()) ||
  '';

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [token] = useState<string>(envToken);

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
    return client;
  }, [token]);

  return (
    <ApiContext.Provider value={{ token, api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used inside ApiProvider');
  return context;
}
