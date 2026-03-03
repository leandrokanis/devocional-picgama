import { Button, Group, Stack, Table, TextInput, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '../services/api-provider';
import type { ReadingsResponse } from '../types/api';

export function ReadingsPage() {
  const { api } = useApi();
  const [date, setDate] = useState('');

  const readings = useQuery({
    queryKey: ['readings', date],
    queryFn: async () => {
      const suffix = date ? `?date=${date}` : '';
      return (await api.get<ReadingsResponse>(`/readings${suffix}`)).data;
    }
  });

  return (
    <Stack>
      <Title order={2}>Leituras</Title>
      <Group>
        <TextInput placeholder="YYYY-MM-DD" value={date} onChange={(event) => setDate(event.currentTarget.value)} />
        <Button onClick={() => readings.refetch()}>Filtrar</Button>
      </Group>
      <Table withTableBorder striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Data</Table.Th>
            <Table.Th>Leitura</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {(readings.data?.data || []).map((reading) => (
            <Table.Tr key={`${reading.date}-${reading.reading}`}>
              <Table.Td>{reading.date}</Table.Td>
              <Table.Td>{reading.reading}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}
