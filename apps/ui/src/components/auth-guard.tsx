import { Alert, Stack, Title } from '@mantine/core';
import { useApi } from '../services/api-provider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token } = useApi();

  if (token) return <>{children}</>;

  return (
    <Stack maw={420} mx="auto" mt={120}>
      <Title order={2}>Acesso ao painel</Title>
      <Alert color="violet">Token nao configurado. Defina `VITE_AUTH_TOKEN` no ambiente da UI.</Alert>
    </Stack>
  );
}
