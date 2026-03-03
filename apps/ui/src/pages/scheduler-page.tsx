import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
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

  const start = useMutation({
    mutationFn: async () => api.post('/scheduler/start'),
    onSuccess: () => status.refetch()
  });

  const stop = useMutation({
    mutationFn: async () => api.post('/scheduler/stop'),
    onSuccess: () => status.refetch()
  });

  const sendNow = useMutation({
    mutationFn: async () => api.post('/send')
  });

  return (
    <Stack>
      <Title order={2}>Scheduler</Title>
      <Card withBorder>
        <Text>Status: {status.data?.running ? 'Ativo' : 'Parado'}</Text>
        <Text>Horário: {status.data?.sendTime || '-'}</Text>
        <Text>Próxima execução: {status.data?.nextExecution || '-'}</Text>
      </Card>
      <Group>
        <Button onClick={() => start.mutate()} loading={start.isPending}>Iniciar</Button>
        <Button color="orange" onClick={() => stop.mutate()} loading={stop.isPending}>Parar</Button>
        <Button variant="light" onClick={() => sendNow.mutate()} loading={sendNow.isPending}>Enviar agora</Button>
      </Group>
    </Stack>
  );
}
