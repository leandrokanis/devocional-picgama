import { Alert, Button, Card, Group, MultiSelect, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconSend, IconX } from '@tabler/icons-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import type { ManualSendRequest, ManualSendResult, ManualSendStatus, Recipient } from '@devocional/shared';
import { useApi } from '../services/api-provider';
import type { ManualSendResponse, RecipientsResponse } from '../types/api';

const ICON_SIZE = 14;

const STATUS_VIEW: Record<ManualSendStatus, { label: string; color: string; icon: typeof IconCheck }> = {
  sent: { label: 'Recebeu', color: 'green', icon: IconCheck },
  sent_with_warnings: { label: 'Recebeu com aviso', color: 'yellow', icon: IconAlertTriangle },
  failed: { label: 'Falhou', color: 'red', icon: IconX }
};

type SendError = { disconnected: boolean; message: string };

const toSendError = (error: unknown): SendError => {
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 503) {
      return { disconnected: true, message: error.response.data?.error || 'Conecte o WhatsApp antes de enviar.' };
    }
    return { disconnected: false, message: error.response?.data?.error || 'Não foi possível enviar a leitura.' };
  }
  return { disconnected: false, message: 'Não foi possível enviar a leitura.' };
};

const recipientLabel = (result: ManualSendResult) => result.name || `Destinatário #${result.recipientId}`;

type SendReadingCardProps = {
  date: string;
  hasPendingEdit: boolean;
};

export function SendReadingCard({ date, hasPendingEdit }: SendReadingCardProps) {
  const { api } = useApi();
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<ManualSendResult[] | null>(null);
  const [sendError, setSendError] = useState<SendError | null>(null);

  const recipients = useQuery({
    queryKey: ['recipients'],
    queryFn: async () => (await api.get<RecipientsResponse>('/recipients')).data.data
  });

  const sendReading = useMutation({
    mutationFn: async (payload: ManualSendRequest) => (await api.post<ManualSendResponse>(`/readings/${date}/send`, payload)).data.data,
    onMutate: () => {
      setSendError(null);
      setResults(null);
    },
    onSuccess: (data) => setResults(data),
    onError: (error) => setSendError(toSendError(error))
  });

  const options = (recipients.data ?? []).map((recipient: Recipient) => ({
    value: String(recipient.id),
    label: `${recipient.name} (${recipient.type === 'group' ? 'grupo' : 'pessoa'})`
  }));

  const blockedReason = (() => {
    if (hasPendingEdit) return 'Salve as alterações da leitura antes de enviar.';
    if (selected.length === 0) return 'Selecione ao menos um destinatário.';
    return null;
  })();

  const confirmSend = () => {
    const count = selected.length;
    const noun = count === 1 ? 'destinatário' : 'destinatários';
    if (window.confirm(`Enviar a leitura de ${date} para ${count} ${noun}?`)) {
      sendReading.mutate({ recipientIds: selected.map(Number) });
    }
  };

  return (
    <Card withBorder>
      <Stack data-testid="send-reading">
        <Title order={4}>Enviar</Title>
        <MultiSelect
          label="Destinatários"
          placeholder={recipients.isPending ? 'Carregando…' : 'Escolha um ou mais'}
          data={options}
          value={selected}
          onChange={setSelected}
          searchable
          clearable
          disabled={recipients.isPending || sendReading.isPending}
          error={recipients.isError ? 'Não foi possível carregar os destinatários.' : undefined}
          nothingFoundMessage="Nenhum destinatário"
        />
        <Group justify="space-between">
          <Button
            size="xs"
            variant="subtle"
            disabled={options.length === 0 || sendReading.isPending}
            onClick={() => setSelected(options.map((option) => option.value))}
          >
            Selecionar todos
          </Button>
          <Button
            leftSection={<IconSend size={ICON_SIZE} />}
            disabled={blockedReason !== null}
            loading={sendReading.isPending}
            onClick={confirmSend}
          >
            Enviar
          </Button>
        </Group>
        {blockedReason && (
          <Text size="sm" c={hasPendingEdit ? 'yellow' : 'dimmed'}>
            {blockedReason}
          </Text>
        )}
        {sendError &&
          (sendError.disconnected ? (
            <Alert color="yellow" title="WhatsApp desconectado" withCloseButton onClose={() => setSendError(null)}>
              {sendError.message}
            </Alert>
          ) : (
            <Alert color="red" title="Erro" withCloseButton onClose={() => setSendError(null)}>
              {sendError.message}
            </Alert>
          ))}
        {results && (
          <Stack gap="xs" data-testid="send-results" aria-live="polite">
            {results.map((result) => {
              const view = STATUS_VIEW[result.status];
              const StatusIcon = view.icon;
              const details = result.error ? [result.error] : result.warnings;
              return (
                <Group key={result.recipientId} gap="xs" align="flex-start" wrap="nowrap">
                  <ThemeIcon size="sm" variant="light" color={view.color}>
                    <StatusIcon size={ICON_SIZE} />
                  </ThemeIcon>
                  <Stack gap={0}>
                    <Text size="sm">
                      {recipientLabel(result)} — {view.label}
                    </Text>
                    {details.map((detail) => (
                      <Text key={detail} size="xs" c="dimmed">
                        {detail}
                      </Text>
                    ))}
                  </Stack>
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
