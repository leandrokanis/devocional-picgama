import { Card, Grid, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useApi } from '../services/api-provider';
import type { HealthResponse } from '../types/api';

export function DashboardPage() {
  const { api } = useApi();

  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => (await api.get<HealthResponse>('/health')).data,
    refetchInterval: 5000
  });

  const recipients = useQuery({
    queryKey: ['recipients-count'],
    queryFn: async () => (await api.get<{ data: Array<unknown> }>('/api/recipients')).data.data.length
  });

  const today = useQuery({
    queryKey: ['reading-today'],
    queryFn: async () => (await api.get<{ date: string; reading: string }>('/readings/today')).data
  });

  return (
    <Stack>
      <Title order={2}>Dashboard</Title>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Text c="dimmed" size="sm">WhatsApp</Text>
            <Text fw={700}>{health.data?.connected ? 'Conectado' : 'Desconectado'}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Text c="dimmed" size="sm">Scheduler</Text>
            <Text fw={700}>{health.data?.scheduler?.running ? 'Ativo' : 'Parado'}</Text>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card withBorder>
            <Text c="dimmed" size="sm">Destinatários</Text>
            <Text fw={700}>{recipients.data ?? 0}</Text>
          </Card>
        </Grid.Col>
      </Grid>
      <Card withBorder>
        <Text c="dimmed" size="sm">Leitura de hoje</Text>
        <Text fw={700}>{today.data?.date ?? '-'}</Text>
        <Text>{today.data?.reading ?? 'Sem leitura disponível'}</Text>
      </Card>
    </Stack>
  );
}
