import { Alert, Anchor, Card, Stack, Text, TextInput, Title } from '@mantine/core';
import { useApi } from '../services/api-provider';

export function SettingsPage() {
  const { token, setToken } = useApi();

  return (
    <Stack>
      <Title order={2}>Configurações</Title>
      <Card withBorder>
        <Stack>
          <Text c="dimmed">Token de autenticação da API</Text>
          <TextInput
            value={token}
            onChange={(event) => setToken(event.currentTarget.value)}
            placeholder="seu_token_secreto_aqui"
          />
          <Alert color="blue">O token é salvo no localStorage do navegador.</Alert>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Text fw={600}>Documentação</Text>
          <Anchor href="/api/docs" target="_blank">Swagger UI</Anchor>
          <Anchor href="/api/api-docs" target="_blank">OpenAPI JSON</Anchor>
        </Stack>
      </Card>
    </Stack>
  );
}
