import { Alert, Badge, Button, FileButton, Group, Stack, Table, Text, TextInput, Title } from '@mantine/core';
import { IconFileImport, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { ImportResult } from '@devocional/shared';
import { useApi } from '../services/api-provider';
import type { ImportReadingsResponse, ReadingsResponse } from '../types/api';
import { formatDuration } from '../utils/audio-format';
import type { ReadingDetailState } from './reading-detail-page';

const JSON_ACCEPT = 'application/json,.json';
const ICON_SIZE = 14;

type ReadingRange = { from: string; to: string };

const localToday = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Without "from" in the URL the list starts today; "Todas" writes an explicit empty "from=" to opt out.
const rangeFromParams = (params: URLSearchParams): ReadingRange => ({
  from: params.has('from') ? params.get('from') ?? '' : localToday(),
  to: params.get('to') ?? ''
});

const rangeQuery = ({ from, to }: ReadingRange) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const errorMessage = (error: unknown, fallback: string) => {
  if (isAxiosError<{ error?: string }>(error)) return error.response?.data?.error || fallback;
  return fallback;
};

export function ReadingsPage() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const range = rangeFromParams(searchParams);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const readings = useQuery({
    queryKey: ['readings', range.from, range.to],
    queryFn: async () => (await api.get<ReadingsResponse>(`/readings${rangeQuery(range)}`)).data
  });

  const setRange = (next: ReadingRange) => {
    const params = new URLSearchParams();
    params.set('from', next.from);
    if (next.to) params.set('to', next.to);
    setSearchParams(params, { replace: true });
  };

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
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['readings'] })
  });

  const onImportSelected = (file: File | null) => {
    if (file) importReadings.mutate(file);
  };

  const detailState: ReadingDetailState = { listSearch: location.search };
  const openReading = (date: string) => navigate(`/readings/${date}`, { state: detailState });

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
          <Button
            leftSection={<IconPlus size={ICON_SIZE} />}
            onClick={() => navigate('/readings/new', { state: detailState })}
          >
            Nova leitura
          </Button>
        </Group>
      </Group>
      <Group align="flex-end">
        <TextInput
          type="date"
          label="De"
          value={range.from}
          max={range.to || undefined}
          onChange={(event) => setRange({ ...range, from: event.currentTarget.value })}
        />
        <TextInput
          type="date"
          label="Até"
          value={range.to}
          min={range.from || undefined}
          onChange={(event) => setRange({ ...range, to: event.currentTarget.value })}
        />
        <Button variant="light" onClick={() => setRange({ from: localToday(), to: '' })}>
          Próximas
        </Button>
        <Button variant="subtle" onClick={() => setRange({ from: '', to: '' })}>
          Todas
        </Button>
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
      <Table withTableBorder striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Passagem</Table.Th>
            <Table.Th>Título</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Duração</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(readings.data?.data || []).map((reading) => (
            <Table.Tr
              key={reading.date}
              onClick={() => openReading(reading.date)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') openReading(reading.date);
              }}
              tabIndex={0}
              style={{ cursor: 'pointer' }}
            >
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
                {reading.status === 'ready' ? (
                  <Badge color="green" variant="light">
                    Pronto
                  </Badge>
                ) : (
                  <Badge color="gray" variant="light">
                    Pendente
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" c={reading.audio?.durationSeconds == null ? 'dimmed' : undefined}>
                  {formatDuration(reading.audio?.durationSeconds)}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
