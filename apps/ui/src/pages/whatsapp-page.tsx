import { Alert, Button, Card, Group, Image, Stack, Text, Title } from '@mantine/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useApi } from '../services/api-provider';
import type { QrResponse } from '../types/api';

export function WhatsAppPage() {
  const { api } = useApi();

  const qrQuery = useQuery({
    queryKey: ['qr-status'],
    queryFn: async () => (await api.get<QrResponse>('/qr')).data,
    refetchInterval: 5000
  });

  const reconnect = useMutation({
    mutationFn: async () => (await api.get<QrResponse>('/qr?reconnect=true')).data,
    onSuccess: () => qrQuery.refetch()
  });

  return (
    <Stack>
      <Title order={2}>WhatsApp</Title>
      <Card withBorder>
        <Text>Status: {qrQuery.data?.connected ? 'Conectado' : 'Desconectado'}</Text>
        <Text c="dimmed">{qrQuery.data?.message}</Text>
        <Group mt="md">
          <Button onClick={() => reconnect.mutate()} loading={reconnect.isPending}>
            Forçar reconexão
          </Button>
          <Button variant="light" onClick={() => qrQuery.refetch()}>Atualizar</Button>
        </Group>
      </Card>
      {!qrQuery.data?.connected && qrQuery.data?.qr && (
        <Card withBorder>
          <Image src={qrQuery.data.qr} alt="QR Code" maw={360} />
        </Card>
      )}
      {qrQuery.isError && <Alert color="red">Falha ao carregar status do WhatsApp</Alert>}
    </Stack>
  );
}
