import { createContext, useContext, useMemo, useState } from 'react';
import axios from 'axios';

type ApiContextValue = {
  token: string;
  setToken: (token: string) => void;
  api: ReturnType<typeof axios.create>;
};

const ApiContext = createContext<ApiContextValue | null>(null);
const tokenKey = 'devocional_admin_token';

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string>(() => localStorage.getItem(tokenKey) || '');

  const setToken = (value: string) => {
    setTokenState(value);
    localStorage.setItem(tokenKey, value);
  };

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
    <ApiContext.Provider value={{ token, setToken, api }}>
      {children}
    </ApiContext.Provider>
  );
}

export function useApi() {
  const context = useContext(ApiContext);
  if (!context) throw new Error('useApi must be used inside ApiProvider');
  return context;
}
