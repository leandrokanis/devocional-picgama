import { Alert, Button, Card, PasswordInput, Stack, TextInput, Title } from '@mantine/core';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../services/api-provider';

type LoginErrorResponse = {
  error?: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useApi();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUser = user.trim();
    const trimmedPassword = password.trim();
    if (!trimmedUser || !trimmedPassword) {
      setError('Informe usuario e senha');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await login(trimmedUser, trimmedPassword);
      navigate('/', { replace: true });
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? err.response?.data?.error || 'Falha ao autenticar'
          : 'Falha ao autenticar';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Stack align="center" justify="center" h="100vh" p="md">
      <Card withBorder miw={340} maw={420} w="100%">
        <form onSubmit={handleSubmit}>
          <Stack>
            <Title order={3}>Acesso ao painel</Title>
            <TextInput
              label="Usuario"
              placeholder="admin"
              value={user}
              onChange={(event) => setUser(event.currentTarget.value)}
            />
            <PasswordInput
              label="Senha"
              placeholder="********"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
            {error ? <Alert color="red">{error}</Alert> : null}
            <Button type="submit" loading={submitting}>Entrar</Button>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
