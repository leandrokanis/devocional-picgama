import { Alert, Anchor, Card, Stack, Text, Title } from '@mantine/core';

export function SettingsPage() {
  return (
    <Stack>
      <Title order={2}>Configurações</Title>
      <Card withBorder>
        <Stack>
          <Text c="dimmed">Autenticacao do painel</Text>
          <Alert color="blue">Use `ADMIN_USER` e `ADMIN_PASSWORD` para acessar o painel. A sessao fica no navegador apos o login.</Alert>
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
