import { Button, Card, Group, Stack, Switch, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../services/api-provider';
import type { SchedulerStatus } from '@devocional/shared';

export function SchedulerPage() {
  const { api } = useApi();

  const status = useQuery({
    queryKey: ['scheduler-status'],
    queryFn: async () => (await api.get<SchedulerStatus>('/scheduler/status')).data,
    refetchInterval: 5000
  });

  const toggle = useMutation({
    mutationFn: async (running: boolean) => {
      if (running) await api.post('/scheduler/stop');
      else await api.post('/scheduler/start');
    },
    onSuccess: () => status.refetch()
  });

  const sendNow = useMutation({
    mutationFn: async () => api.post('/send')
  });

  const running = status.data?.running ?? false;

  return (
    <Stack>
      <Title order={2}>Scheduler</Title>
      <Card withBorder>
        <Stack gap="xs">
          <Switch
            checked={running}
            onChange={() => toggle.mutate(running)}
            disabled={toggle.isPending}
            label={running ? 'Ativo' : 'Parado'}
          />
          <Text size="sm" c="dimmed">Horário: {status.data?.sendTime || '-'}</Text>
          <Text size="sm" c="dimmed">Próxima execução: {status.data?.nextExecution || '-'}</Text>
        </Stack>
      </Card>
      <Group>
        <Button variant="light" onClick={() => sendNow.mutate()} loading={sendNow.isPending}>
          Enviar agora
        </Button>
      </Group>
    </Stack>
  );
}
