import React from 'react';
import ReactDOM from 'react-dom/client';
import { ColorSchemeScript, MantineProvider, createTheme } from '@mantine/core';
import '@mantine/core/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ApiProvider } from './services/api-provider';

const queryClient = new QueryClient();
const theme = createTheme({
  primaryColor: 'violet',
  defaultRadius: 'md'
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ColorSchemeScript defaultColorScheme="dark" />
    <MantineProvider theme={theme} defaultColorScheme="dark">
      <QueryClientProvider client={queryClient}>
        <ApiProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ApiProvider>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>
);
