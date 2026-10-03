import { beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (update: Record<string, unknown>) => unknown;

const fakeSocket = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  sendMessage: vi.fn(async () => ({})),
  end: vi.fn()
}));

vi.mock('@whiskeysockets/baileys', () => ({
  default: () => ({
    ev: { on: (event: string, handler: Handler) => fakeSocket.handlers.set(event, handler) },
    sendMessage: fakeSocket.sendMessage,
    end: fakeSocket.end
  }),
  DisconnectReason: { loggedOut: 401 },
  fetchLatestBaileysVersion: async () => ({ version: [2, 3000, 0] }),
  makeCacheableSignalKeyStore: (keys: unknown) => keys
}));

vi.mock('./whatsapp-auth.js', () => ({
  WhatsAppAuthService: class {
    async useAuthState() {
      return { state: { creds: {}, keys: {} }, saveCreds: async () => {} };
    }
    async clearAuth() {}
  }
}));

const { WhatsAppService } = await import('./whatsapp.js');

const connectedService = async () => {
  const service = new WhatsAppService({ sessionName: 'test' });
  await service.initialize();
  await fakeSocket.handlers.get('connection.update')?.({ connection: 'open' });
  return service;
};

beforeEach(() => {
  fakeSocket.handlers.clear();
  fakeSocket.sendMessage.mockReset();
  fakeSocket.sendMessage.mockResolvedValue({});
});

describe('WhatsAppService.sendVoiceMessage', () => {
  test('sends the buffer as an ogg/opus voice note (ptt)', async () => {
    const service = await connectedService();
    const audio = Buffer.from('ogg');
    const sent = await service.sendVoiceMessage(audio, ' 123@g.us ');
    expect({ sent, calls: fakeSocket.sendMessage.mock.calls }).toEqual({
      sent: true,
      calls: [['123@g.us', { audio, mimetype: 'audio/ogg; codecs=opus', ptt: true }]]
    });
  });

  test('returns false without sending when WhatsApp is not connected', async () => {
    const service = new WhatsAppService({ sessionName: 'test' });
    await service.initialize();
    const sent = await service.sendVoiceMessage(Buffer.from('ogg'), '123@g.us');
    expect({ sent, calls: fakeSocket.sendMessage.mock.calls.length }).toEqual({ sent: false, calls: 0 });
  });

  test('returns false instead of throwing when the socket fails', async () => {
    const service = await connectedService();
    fakeSocket.sendMessage.mockRejectedValueOnce(new Error('upload failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await service.sendVoiceMessage(Buffer.from('ogg'), '123@g.us')).toBe(false);
  });
});
