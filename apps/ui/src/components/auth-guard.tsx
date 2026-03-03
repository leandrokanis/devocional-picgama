import { Alert, Button, Stack, TextInput, Title } from '@mantine/core';
import { useState } from 'react';
import { useApi } from '../services/api-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, setToken } = useApi();
  const [input, setInput] = useState(token);

  if (token) return <>{children}</>;

  return (
    <Stack maw={420} mx="auto" mt={120}>
      <Title order={2}>Acesso ao painel</Title>
      <Alert color="violet">Informe o token Bearer da API para continuar.</Alert>
      <TextInput
        value={input}
        onChange={(event) => setInput(event.currentTarget.value)}
        placeholder="seu_token_secreto_aqui"
      />
      <Button onClick={() => setToken(input.trim())}>Entrar</Button>
    </Stack>
  );
}
