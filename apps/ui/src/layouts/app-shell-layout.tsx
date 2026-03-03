import { AppShell, Burger, Group, NavLink, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useApi } from '../services/api-provider';

const links = [
  { label: 'Dashboard', to: '/' },
  { label: 'WhatsApp', to: '/whatsapp' },
  { label: 'Destinatários', to: '/recipients' },
  { label: 'Leituras', to: '/readings' },
  { label: 'Scheduler', to: '/scheduler' },
  { label: 'Configurações', to: '/settings' }
];

export function AppShellLayout() {
  const [opened, { toggle }] = useDisclosure();
  const location = useLocation();
  const { setToken } = useApi();

  return (
    <AppShell
      navbar={{ width: 260, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      header={{ height: 64 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700}>Devocional Admin</Text>
          </Group>
          <NavLink label="Sair" onClick={() => setToken('')} />
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="md">
        {links.map((link) => (
          <NavLink
            key={link.to}
            component={Link}
            to={link.to}
            label={link.label}
            active={location.pathname === link.to}
          />
        ))}
      </AppShell.Navbar>
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
