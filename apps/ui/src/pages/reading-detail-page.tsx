import { Alert, Anchor, Button, Card, Group, Loader, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { IconArrowLeft, IconInfoCircle, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import type { DevotionalReading, ReadingInput } from '@devocional/shared';
import { AudioDropzone } from '../components/audio-dropzone';
import { useApi } from '../services/api-provider';
import { readListSearch } from '../utils/readings-list-search';
import type { ReadingResponse } from '../types/api';
import { formatDuration, formatSize } from '../utils/audio-format';
import { isCompleteDate } from '../utils/date-input';

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
const AUTOSAVE_DELAY_MS = 800;
const CLOCK_TICK_MS = 30_000;

const sameForm = (left: ReadingForm, right: ReadingForm) =>
  (Object.keys(left) as (keyof ReadingForm)[]).every((field) => left[field] === right[field]);

const canSave = (form: ReadingForm) => isCompleteDate(form.date) && form.passage.trim() !== '';

const relativeTime = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

const savedAgo = (savedAt: Date, now: number) => {
  if (Number.isNaN(savedAt.getTime())) return 'Salvo';
  const minutes = Math.max(0, Math.floor((now - savedAt.getTime()) / 60_000));
  if (minutes < 1) return 'Salvo agora mesmo';
  if (minutes < 60) return `Salvo ${relativeTime.format(-minutes, 'minute')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Salvo ${relativeTime.format(-hours, 'hour')}`;
  return `Salvo ${relativeTime.format(-Math.floor(hours / 24), 'day')}`;
};

export type ReadingDetailState = { listSearch?: string };

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: string }>(error)) {
    if (error.response?.status === 413) return error.response.data?.error || 'Arquivo acima do limite permitido.';
    return error.response?.data?.error || fallback;
  }
  return fallback;
};

const publishedAtFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const formatPublishedAt = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : publishedAtFormat.format(date);
};

const isNotFound = (error: unknown) => isAxiosError(error) && error.response?.status === 404;

export function ReadingDetailPage() {
  const { date: routeDate } = useParams<{ date: string }>();
  const isNew = routeDate === undefined;
  const { api, token } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const listSearch = (location.state as ReadingDetailState | null)?.listSearch ?? readListSearch();
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
  // What the server holds for this page; the form autosaves whenever it drifts from it.
  const [savedForm, setSavedForm] = useState<ReadingForm>(emptyForm);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [failedForm, setFailedForm] = useState<ReadingForm | null>(null);
  useEffect(() => {
    if (isNew) {
      setForm(emptyForm);
      setSavedForm(emptyForm);
      setSavedAt(null);
      setFormFor(null);
    } else if (reading.data && reading.data.date !== formFor) {
      setForm(toForm(reading.data));
      setSavedForm(toForm(reading.data));
      setSavedAt(new Date(reading.data.updatedAt));
      setFormFor(reading.data.date);
    }
  }, [isNew, reading.data, formFor]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

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
    onSuccess: async (saved, sent) => {
      setSavedForm(sent);
      setSavedAt(new Date(saved.updatedAt));
      setFailedForm(null);
      setNow(Date.now());
      if (saved.date !== routeDate) setFormFor(saved.date);
      // PUT/POST answer without the publication history; it moves with the date, so keep what the page had.
      const previous = queryClient.getQueryData<DevotionalReading>(['reading', routeDate]);
      queryClient.setQueryData(['reading', saved.date], { ...saved, publications: previous?.publications ?? [] });
      await refresh();
      if (saved.date !== routeDate) {
        navigate(`/readings/${saved.date}`, { replace: true, state: location.state });
      }
    },
    onError: (error, sent) => {
      setFailedForm(sent);
      setFormError(errorMessage(error, 'Não foi possível salvar a leitura.'));
    }
  });

  const dirty = !sameForm(form, savedForm);
  const blocked = failedForm !== null && sameForm(form, failedForm);
  const savable = dirty && canSave(form) && !blocked;

  // Autosave: wait for a pause in typing, one request at a time; the next edit retries after a failure.
  useEffect(() => {
    if (!savable || saveReading.isPending) return;
    const timer = window.setTimeout(() => saveReading.mutate(form), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [form, savable, saveReading.isPending]);

  // Leaving with a pending edit (Voltar, menu) still saves it, and closing the tab asks first.
  const pendingRef = useRef<{ form: ReadingForm; savable: boolean; isNew: boolean; routeDate?: string } | null>(null);
  pendingRef.current = { form, savable, isNew, routeDate };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (pendingRef.current?.savable) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => {
      window.removeEventListener('beforeunload', warn);
      const pending = pendingRef.current;
      if (pending?.savable && !pending.isNew) {
        void api.put(`/readings/${pending.routeDate}`, pending.form).then(() => refresh(), () => undefined);
      }
    };
  }, []);

  const saveStatus = (() => {
    if (saveReading.isPending) return { text: 'Salvando…', color: 'dimmed' };
    if (blocked) return { text: 'Não salvo — corrija o erro acima', color: 'red' };
    if (dirty && !canSave(form)) {
      return { text: isNew ? 'Preencha data e passagem para criar a leitura' : 'Preencha data e passagem para salvar', color: 'yellow' };
    }
    if (dirty) return { text: 'Alterações pendentes…', color: 'dimmed' };
    if (savedAt) return { text: savedAgo(savedAt, now), color: 'dimmed' };
    return null;
  })();

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
    const audioWarning = reading.data?.audio ? ' O áudio anexado também será removido.' : '';
    const publicationsWarning = reading.data?.publications?.length ? ' O histórico de publicação também será removido.' : '';
    const warning = `${audioWarning}${publicationsWarning}`;
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
  const publications = reading.data?.publications ?? [];
  const audioSrc = audio
    ? `/api/readings/${routeDate}/audio?token=${encodeURIComponent(token)}&v=${encodeURIComponent(audio.updatedAt)}`
    : '';

  return (
    <Stack maw={720}>
      {backLink}
      <Group justify="space-between">
        <Stack gap={2}>
          <Title order={2}>{isNew ? 'Nova leitura' : `Leitura de ${routeDate}`}</Title>
          {saveStatus && (
            <Text size="sm" c={saveStatus.color} data-testid="save-status" aria-live="polite">
              {saveStatus.text}
            </Text>
          )}
        </Stack>
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
      {publications.length > 0 && (
        <Alert color="blue" icon={<IconInfoCircle size={ICON_SIZE} />} title="Leitura publicada" data-testid="published-alert">
          Já publicada em {publications.length} {publications.length === 1 ? 'grupo' : 'grupos'}; edições não chegam a quem já
          recebeu.
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
      {!isNew && (
        <Card withBorder>
          <Stack gap="xs" data-testid="publications">
            <Title order={4}>Publicações</Title>
            {publications.length === 0 ? (
              <Text size="sm" c="dimmed">
                Ainda não publicada
              </Text>
            ) : (
              publications.map((publication, index) => (
                <Group key={`${publication.chatId}-${publication.publishedAt}-${index}`} justify="space-between">
                  <Text size="sm">{publication.groupName}</Text>
                  <Text size="sm" c="dimmed">
                    {formatPublishedAt(publication.publishedAt)}
                  </Text>
                </Group>
              ))
            )}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
