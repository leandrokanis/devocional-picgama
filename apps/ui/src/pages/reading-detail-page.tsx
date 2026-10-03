import { Alert, Anchor, Button, Card, Group, Loader, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { DevotionalReading, ReadingInput } from '@devocional/shared';
import { AudioDropzone } from '../components/audio-dropzone';
import { useApi } from '../services/api-provider';
import type { ReadingResponse } from '../types/api';
import { formatDuration, formatSize } from '../utils/audio-format';

type ReadingForm = Required<ReadingInput>;

const emptyForm: ReadingForm = { date: '', passage: '', title: '', description: '', link: '' };

const toForm = (reading: DevotionalReading): ReadingForm => ({
  date: reading.date,
  passage: reading.passage,
  title: reading.title,
  description: reading.description,
  link: reading.link
});

const ICON_SIZE = 14;

export type ReadingDetailState = { listSearch?: string };

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 413) return error.response.data?.error || 'Arquivo acima do limite permitido.';
    return error.response?.data?.error || fallback;
  }
  return fallback;
};

const isNotFound = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

export function ReadingDetailPage() {
  const { date: routeDate } = useParams<{ date: string }>();
  const isNew = routeDate === undefined;
  const { api, token } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const listSearch = (location.state as ReadingDetailState | null)?.listSearch ?? '';
  const listPath = `/readings${listSearch}`;

  const [form, setForm] = useState<ReadingForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  const reading = useQuery({
    queryKey: ['reading', routeDate],
    enabled: !isNew,
    retry: (failureCount, error) => !isNotFound(error) && failureCount < 2,
    queryFn: async () => (await api.get<ReadingResponse>(`/readings/${routeDate}`)).data.data
  });

  // Fill the form once per opened reading, so refetches after an audio change keep unsaved edits.
  const [formFor, setFormFor] = useState<string | null>(null);
  useEffect(() => {
    if (isNew) {
      setForm(emptyForm);
      setFormFor(null);
    } else if (reading.data && reading.data.date !== formFor) {
      setForm(toForm(reading.data));
      setFormFor(reading.data.date);
    }
  }, [isNew, reading.data, formFor]);

  const refresh = async (date?: string) => {
    await queryClient.invalidateQueries({ queryKey: ['readings'] });
    if (date) await queryClient.invalidateQueries({ queryKey: ['reading', date] });
  };

  const saveReading = useMutation({
    mutationFn: async (payload: ReadingForm) =>
      (isNew
        ? await api.post<ReadingResponse>('/readings', payload)
        : await api.put<ReadingResponse>(`/readings/${routeDate}`, payload)
      ).data.data,
    onMutate: () => setFormError(null),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['reading', saved.date], saved);
      await refresh();
      if (saved.date !== routeDate) {
        navigate(`/readings/${saved.date}`, { replace: true, state: location.state });
      }
    },
    onError: (error) => setFormError(errorMessage(error, 'Não foi possível salvar a leitura.'))
  });

  const deleteReading = useMutation({
    mutationFn: async () => api.delete(`/readings/${routeDate}`),
    onMutate: () => setFormError(null),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['reading', routeDate] });
      await refresh();
      navigate(listPath);
    },
    onError: (error) => setFormError(errorMessage(error, 'Não foi possível excluir a leitura.'))
  });

  const uploadAudio = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      // Override the client's default JSON Content-Type so the browser sends multipart with its boundary.
      return api.put(`/readings/${routeDate}/audio`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onMutate: () => setAudioError(null),
    onError: (error) => setAudioError(errorMessage(error, 'Não foi possível enviar o áudio.')),
    onSettled: () => refresh(routeDate)
  });

  const removeAudio = useMutation({
    mutationFn: async () => api.delete(`/readings/${routeDate}/audio`),
    onMutate: () => setAudioError(null),
    onError: (error) => setAudioError(errorMessage(error, 'Não foi possível remover o áudio.')),
    onSettled: () => refresh(routeDate)
  });

  const setField = (field: keyof ReadingForm) => (event: { currentTarget: { value: string } }) => {
    const value = event.currentTarget.value;
    setForm((state) => ({ ...state, [field]: value }));
  };

  const confirmDelete = () => {
    const warning = reading.data?.audio ? ' O áudio anexado também será removido.' : '';
    if (window.confirm(`Excluir a leitura de ${routeDate}?${warning}`)) deleteReading.mutate();
  };

  const confirmRemoveAudio = () => {
    if (window.confirm(`Remover o áudio de ${routeDate}?`)) removeAudio.mutate();
  };

  const backLink = (
    <Anchor component={Link} to={listPath} size="sm">
      <Group gap={4}>
        <IconArrowLeft size={ICON_SIZE} />
        Leituras
      </Group>
    </Anchor>
  );

  if (!isNew && reading.isPending) {
    return (
      <Stack>
        {backLink}
        <Loader />
      </Stack>
    );
  }

  if (!isNew && reading.isError) {
    return (
      <Stack>
        {backLink}
        {isNotFound(reading.error) ? (
          <Alert color="yellow" title="Leitura não encontrada">
            Não há leitura cadastrada para {routeDate}.
          </Alert>
        ) : (
          <Alert color="red" title="Erro">
            {errorMessage(reading.error, 'Não foi possível carregar a leitura.')}
          </Alert>
        )}
      </Stack>
    );
  }

  const audio = reading.data?.audio ?? null;
  const audioSrc = audio
    ? `/api/readings/${routeDate}/audio?token=${encodeURIComponent(token)}&v=${encodeURIComponent(audio.updatedAt)}`
    : '';

  return (
    <Stack maw={720}>
      {backLink}
      <Group justify="space-between">
        <Title order={2}>{isNew ? 'Nova leitura' : `Leitura de ${routeDate}`}</Title>
        {!isNew && (
          <Button
            color="red"
            variant="light"
            leftSection={<IconTrash size={ICON_SIZE} />}
            loading={deleteReading.isPending}
            onClick={confirmDelete}
          >
            Excluir leitura
          </Button>
        )}
      </Group>
      {formError && (
        <Alert color="red" title="Erro" withCloseButton onClose={() => setFormError(null)}>
          {formError}
        </Alert>
      )}
      <Card withBorder>
        <Stack>
          <TextInput label="Data" type="date" required value={form.date} onChange={setField('date')} />
          <TextInput label="Passagem" placeholder="Mateus 16-18" required value={form.passage} onChange={setField('passage')} />
          <TextInput
            label="Título"
            description="Sem título, só a mensagem da leitura é enviada."
            value={form.title}
            onChange={setField('title')}
          />
          <Textarea label="Descrição" autosize minRows={3} value={form.description} onChange={setField('description')} />
          <TextInput label="Link do episódio" placeholder="https://open.spotify.com/..." value={form.link} onChange={setField('link')} />
          <Group justify="flex-end">
            <Button loading={saveReading.isPending} onClick={() => saveReading.mutate(form)}>
              Salvar
            </Button>
          </Group>
        </Stack>
      </Card>
      <Card withBorder>
        <Stack>
          <Title order={4}>Áudio</Title>
          {audioError && (
            <Alert color="red" title="Erro" withCloseButton onClose={() => setAudioError(null)}>
              {audioError}
            </Alert>
          )}
          {audio && (
            <Stack gap="xs" data-testid="audio-player">
              <audio key={audio.updatedAt} controls style={{ width: '100%' }} src={audioSrc} />
              <Group justify="space-between">
                <Text size="sm" truncate maw={420} title={audio.originalName}>
                  {audio.originalName} · {formatSize(audio.sizeBytes)} · {formatDuration(audio.durationSeconds)}
                </Text>
                <Button
                  size="xs"
                  color="red"
                  variant="subtle"
                  leftSection={<IconTrash size={ICON_SIZE} />}
                  loading={removeAudio.isPending}
                  onClick={confirmRemoveAudio}
                >
                  Remover
                </Button>
              </Group>
            </Stack>
          )}
          <AudioDropzone
            onDrop={(file) => uploadAudio.mutate(file)}
            uploading={uploadAudio.isPending}
            disabled={isNew}
            hasAudio={audio !== null}
          />
        </Stack>
      </Card>
    </Stack>
  );
}
