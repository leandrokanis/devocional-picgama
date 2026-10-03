import { Alert, Button, FileButton, Group, Modal, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconPlayerPlay, IconReplace, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import type { DevotionalReading } from '@devocional/shared';
import { useApi } from '../services/api-provider';
import type { ReadingsResponse } from '../types/api';

type AudioUpload = { date: string; file: File };

const MP3_ACCEPT = 'audio/mpeg,.mp3';
const ICON_SIZE = 14;

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 413) return error.response.data?.error || 'Arquivo acima do limite permitido.';
    return error.response?.data?.error || fallback;
  }
  return fallback;
};

export function ReadingsPage() {
  const { api, token } = useApi();
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<DevotionalReading | null>(null);

  const readings = useQuery({
    queryKey: ['readings', date],
    queryFn: async () => {
      const suffix = date ? `?date=${date}` : '';
      return (await api.get<ReadingsResponse>(`/readings${suffix}`)).data;
    }
  });

  const refreshReadings = () => queryClient.invalidateQueries({ queryKey: ['readings'] });

  const uploadAudio = useMutation({
    mutationFn: async ({ date: readingDate, file }: AudioUpload) => {
      const form = new FormData();
      form.append('file', file);
      // Override the client's default JSON Content-Type so the browser sends multipart with its boundary.
      return api.put(`/readings/${readingDate}/audio`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onMutate: () => setError(null),
    onError: (mutationError) => setError(errorMessage(mutationError, 'Não foi possível enviar o áudio.')),
    onSettled: refreshReadings
  });

  const removeAudio = useMutation({
    mutationFn: async (readingDate: string) => api.delete(`/readings/${readingDate}/audio`),
    onMutate: () => setError(null),
    onError: (mutationError) => setError(errorMessage(mutationError, 'Não foi possível remover o áudio.')),
    onSettled: refreshReadings
  });

  const isUploading = (readingDate: string) => uploadAudio.isPending && uploadAudio.variables?.date === readingDate;
  const isRemoving = (readingDate: string) => removeAudio.isPending && removeAudio.variables === readingDate;

  const onFileSelected = (readingDate: string) => (file: File | null) => {
    if (file) uploadAudio.mutate({ date: readingDate, file });
  };

  const confirmRemove = (reading: DevotionalReading) => {
    if (window.confirm(`Remover o áudio de ${reading.date}?`)) removeAudio.mutate(reading.date);
  };

  const audioSrc = (reading: DevotionalReading) =>
    `/api/readings/${reading.date}/audio?token=${encodeURIComponent(token)}&v=${encodeURIComponent(reading.audio?.updatedAt ?? '')}`;

  return (
    <Stack>
      <Title order={2}>Leituras</Title>
      <Group>
        <TextInput
          placeholder="YYYY-MM-DD"
          value={date}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setDate(value);
          }}
        />
        <Button onClick={() => readings.refetch()}>Filtrar</Button>
      </Group>
      {error && (
        <Alert color="red" title="Erro no áudio" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Leitura</Table.Th>
            <Table.Th>Áudio</Table.Th>
            <Table.Th ta="right">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(readings.data?.data || []).map((reading) => (
            <Table.Tr key={`${reading.date}-${reading.reading}`}>
              <Table.Td>{reading.date}</Table.Td>
              <Table.Td>{reading.reading}</Table.Td>
              <Table.Td>
                {reading.audio ? (
                  <Text size="sm" truncate maw={260} title={reading.audio.originalName}>
                    {reading.audio.originalName} · {formatSize(reading.audio.sizeBytes)}
                  </Text>
                ) : (
                  <FileButton onChange={onFileSelected(reading.date)} accept={MP3_ACCEPT}>
                    {(props) => (
                      <Button
                        {...props}
                        size="xs"
                        variant="light"
                        leftSection={<IconUpload size={ICON_SIZE} />}
                        loading={isUploading(reading.date)}
                      >
                        Anexar mp3
                      </Button>
                    )}
                  </FileButton>
                )}
              </Table.Td>
              <Table.Td>
                <Group gap="xs" wrap="nowrap" justify="flex-end">
                  {reading.audio && (
                    <>
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconPlayerPlay size={ICON_SIZE} />}
                        onClick={() => setPlaying(reading)}
                      >
                        Ouvir
                      </Button>
                      <FileButton onChange={onFileSelected(reading.date)} accept={MP3_ACCEPT}>
                        {(props) => (
                          <Button
                            {...props}
                            size="xs"
                            variant="light"
                            leftSection={<IconReplace size={ICON_SIZE} />}
                            loading={isUploading(reading.date)}
                          >
                            Substituir
                          </Button>
                        )}
                      </FileButton>
                      <Button
                        size="xs"
                        color="red"
                        variant="subtle"
                        leftSection={<IconTrash size={ICON_SIZE} />}
                        loading={isRemoving(reading.date)}
                        onClick={() => confirmRemove(reading)}
                      >
                        Remover
                      </Button>
                    </>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={playing !== null} onClose={() => setPlaying(null)} title={playing ? `Áudio de ${playing.date}` : ''}>
        {playing && <audio controls autoPlay style={{ width: '100%' }} src={audioSrc(playing)} />}
      </Modal>
    </Stack>
  );
}
