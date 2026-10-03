import { Alert, Button, FileButton, Group, Modal, Stack, Table, Text, TextInput, Textarea, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconEdit, IconFileImport, IconPlayerPlay, IconPlus, IconReplace, IconTrash, IconUpload } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import type { DevotionalReading, ImportResult, ReadingInput } from '@devocional/shared';
import { useApi } from '../services/api-provider';
import type { ImportReadingsResponse, ReadingResponse, ReadingsResponse } from '../types/api';

type AudioUpload = { date: string; file: File };

type ReadingForm = Required<ReadingInput> & { originalDate?: string };

const emptyForm: ReadingForm = { date: '', passage: '', title: '', description: '', link: '' };

const toForm = (reading: DevotionalReading): ReadingForm => ({
  originalDate: reading.date,
  date: reading.date,
  passage: reading.passage,
  title: reading.title,
  description: reading.description,
  link: reading.link
});

const MP3_ACCEPT = 'audio/mpeg,.mp3';
const JSON_ACCEPT = 'application/json,.json';
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
  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [form, setForm] = useState<ReadingForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

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

  const saveReading = useMutation({
    mutationFn: async ({ originalDate, ...payload }: ReadingForm) =>
      originalDate
        ? api.put<ReadingResponse>(`/readings/${originalDate}`, payload)
        : api.post<ReadingResponse>('/readings', payload),
    onMutate: () => setFormError(null),
    onSuccess: () => {
      closeForm();
      setForm(emptyForm);
    },
    onError: (mutationError) => setFormError(errorMessage(mutationError, 'Não foi possível salvar a leitura.')),
    onSettled: refreshReadings
  });

  const deleteReading = useMutation({
    mutationFn: async (readingDate: string) => api.delete(`/readings/${readingDate}`),
    onMutate: () => setError(null),
    onError: (mutationError) => setError(errorMessage(mutationError, 'Não foi possível excluir a leitura.')),
    onSettled: refreshReadings
  });

  const importReadings = useMutation({
    mutationFn: async (file: File) => {
      let items: unknown;
      try {
        items = JSON.parse(await file.text());
      } catch {
        throw new Error('O arquivo não é um JSON válido.');
      }
      return (await api.post<ImportReadingsResponse>('/readings/import', items)).data;
    },
    onMutate: () => {
      setError(null);
      setImportResult(null);
    },
    onSuccess: ({ imported, skipped }) => setImportResult({ imported, skipped }),
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error && !isAxiosError(mutationError)
          ? mutationError.message
          : errorMessage(mutationError, 'Não foi possível importar o arquivo.')
      ),
    onSettled: refreshReadings
  });

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    openForm();
  };

  const openEdit = (reading: DevotionalReading) => {
    setForm(toForm(reading));
    setFormError(null);
    openForm();
  };

  const confirmDelete = (reading: DevotionalReading) => {
    const warning = reading.audio ? ' O áudio anexado também será removido.' : '';
    if (window.confirm(`Excluir a leitura de ${reading.date}?${warning}`)) deleteReading.mutate(reading.date);
  };

  const onImportSelected = (file: File | null) => {
    if (file) importReadings.mutate(file);
  };

  const setField = (field: keyof ReadingInput) => (event: { currentTarget: { value: string } }) => {
    const value = event.currentTarget.value;
    setForm((state) => ({ ...state, [field]: value }));
  };

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
      <Group justify="space-between">
        <Title order={2}>Leituras</Title>
        <Group>
          <FileButton onChange={onImportSelected} accept={JSON_ACCEPT}>
            {(props) => (
              <Button
                {...props}
                variant="light"
                leftSection={<IconFileImport size={ICON_SIZE} />}
                loading={importReadings.isPending}
              >
                Importar JSON
              </Button>
            )}
          </FileButton>
          <Button leftSection={<IconPlus size={ICON_SIZE} />} onClick={openCreate}>
            Nova leitura
          </Button>
        </Group>
      </Group>
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
        <Alert color="red" title="Erro" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {importResult && (
        <Alert color="green" title="Import concluído" withCloseButton onClose={() => setImportResult(null)}>
          {importResult.imported} importadas, {importResult.skipped} ignoradas
        </Alert>
      )}
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Passagem</Table.Th>
            <Table.Th>Título</Table.Th>
            <Table.Th>Áudio</Table.Th>
            <Table.Th ta="right">Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(readings.data?.data || []).map((reading) => (
            <Table.Tr key={reading.date}>
              <Table.Td>{reading.date}</Table.Td>
              <Table.Td>{reading.passage}</Table.Td>
              <Table.Td>
                {reading.title ? (
                  <Text size="sm" truncate maw={320} title={reading.title}>
                    {reading.title}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    —
                  </Text>
                )}
              </Table.Td>
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
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconEdit size={ICON_SIZE} />}
                    onClick={() => openEdit(reading)}
                  >
                    Editar
                  </Button>
                  <Button
                    size="xs"
                    color="red"
                    variant="light"
                    leftSection={<IconTrash size={ICON_SIZE} />}
                    loading={deleteReading.isPending && deleteReading.variables === reading.date}
                    onClick={() => confirmDelete(reading)}
                  >
                    Excluir
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <Modal opened={formOpened} onClose={closeForm} title={form.originalDate ? 'Editar leitura' : 'Nova leitura'}>
        <Stack>
          {formError && (
            <Alert color="red" withCloseButton onClose={() => setFormError(null)}>
              {formError}
            </Alert>
          )}
          <TextInput label="Data" placeholder="YYYY-MM-DD" required value={form.date} onChange={setField('date')} />
          <TextInput label="Passagem" placeholder="Mateus 16-18" required value={form.passage} onChange={setField('passage')} />
          <TextInput
            label="Título"
            description="Sem título, só a mensagem da leitura é enviada."
            value={form.title}
            onChange={setField('title')}
          />
          <Textarea label="Descrição" autosize minRows={3} value={form.description} onChange={setField('description')} />
          <TextInput label="Link do episódio" placeholder="https://open.spotify.com/..." value={form.link} onChange={setField('link')} />
          <Button loading={saveReading.isPending} onClick={() => saveReading.mutate(form)}>
            Salvar
          </Button>
        </Stack>
      </Modal>
      <Modal opened={playing !== null} onClose={() => setPlaying(null)} title={playing ? `Áudio de ${playing.date}` : ''}>
        {playing && <audio controls autoPlay style={{ width: '100%' }} src={audioSrc(playing)} />}
      </Modal>
    </Stack>
  );
}
