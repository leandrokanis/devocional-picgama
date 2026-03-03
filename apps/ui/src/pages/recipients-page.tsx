import { Button, Group, Modal, Select, Stack, Table, TextInput, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useApi } from '../services/api-provider';
import type { Recipient } from '@devocional/shared';

type FormState = {
  id?: number;
  chat_id: string;
  name: string;
  type: 'group' | 'person';
};

const defaultForm: FormState = {
  chat_id: '',
  name: '',
  type: 'group'
};

export function RecipientsPage() {
  const { api } = useApi();
  const [opened, { open, close }] = useDisclosure(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const recipients = useQuery({
    queryKey: ['recipients'],
    queryFn: async () => (await api.get<{ data: Recipient[] }>('/api/recipients')).data.data
  });

  const createRecipient = useMutation({
    mutationFn: async (payload: FormState) => api.post('/api/recipients', payload),
    onSuccess: () => {
      recipients.refetch();
      setForm(defaultForm);
      close();
    }
  });

  const updateRecipient = useMutation({
    mutationFn: async (payload: FormState) => api.put(`/api/recipients/${payload.id}`, payload),
    onSuccess: () => {
      recipients.refetch();
      setForm(defaultForm);
      close();
    }
  });

  const deleteRecipient = useMutation({
    mutationFn: async (id: number) => api.delete(`/api/recipients/${id}`),
    onSuccess: () => recipients.refetch()
  });

  const [sendingId, setSendingId] = useState<number | null>(null);

  const sendToRecipient = useMutation({
    mutationFn: async (id: number) => api.post(`/api/recipients/${id}/send`),
    onMutate: (id) => setSendingId(id),
    onSettled: () => setSendingId(null),
    onSuccess: () => recipients.refetch()
  });

  const sendToAll = useMutation({
    mutationFn: async () => api.post('/send'),
    onSuccess: () => recipients.refetch()
  });

  const rows = (recipients.data || []).map((recipient) => (
    <Table.Tr key={recipient.id}>
      <Table.Td>{recipient.id}</Table.Td>
      <Table.Td>{recipient.name}</Table.Td>
      <Table.Td>{recipient.chatId}</Table.Td>
      <Table.Td>{recipient.type}</Table.Td>
      <Table.Td>
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            onClick={() => sendToRecipient.mutate(recipient.id)}
            loading={sendingId === recipient.id}
          >
            Enviar
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={() => {
              setForm({
                id: recipient.id,
                chat_id: recipient.chatId,
                name: recipient.name,
                type: recipient.type
              });
              open();
            }}
          >
            Editar
          </Button>
          <Button size="xs" color="red" variant="subtle" onClick={() => deleteRecipient.mutate(recipient.id)}>
            Remover
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Destinatários</Title>
        <Group>
          <Button
            variant="light"
            onClick={() => sendToAll.mutate()}
            loading={sendToAll.isPending}
          >
            Enviar para todos
          </Button>
          <Button onClick={() => { setForm(defaultForm); open(); }}>Novo destinatário</Button>
        </Group>
      </Group>

      <Table striped withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>ID</Table.Th>
            <Table.Th>Nome</Table.Th>
            <Table.Th>Chat ID</Table.Th>
            <Table.Th>Tipo</Table.Th>
            <Table.Th>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{rows}</Table.Tbody>
      </Table>

      <Modal opened={opened} onClose={close} title={form.id ? 'Editar destinatário' : 'Novo destinatário'}>
        <Stack>
          <TextInput
            label="Nome"
            value={form.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((state) => ({ ...state, name: value }));
            }}
          />
          <TextInput
            label="Chat ID"
            value={form.chat_id}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setForm((state) => ({ ...state, chat_id: value }));
            }}
          />
          <Select
            label="Tipo"
            data={[
              { value: 'group', label: 'Grupo' },
              { value: 'person', label: 'Pessoa' }
            ]}
            value={form.type}
            onChange={(value) => setForm((state) => ({ ...state, type: (value as 'group' | 'person') || 'group' }))}
          />
          <Button
            onClick={() => {
              if (form.id) updateRecipient.mutate(form);
              else createRecipient.mutate(form);
            }}
          >
            Salvar
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
