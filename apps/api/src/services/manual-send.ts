import type { ManualSendResult } from '@devocional/shared';
import type { DevotionalService } from './devotional.js';
import type { DevotionalSender, SendResult, SendTarget } from './devotional-sender.js';
import type { Recipient, RecipientsService } from './recipients.js';

export interface ManualSendConnection {
  getConnectionStatus(): boolean;
}

export type ManualSendReadings = Pick<DevotionalService, 'getReading'>;
export type ManualSendRecipients = Pick<RecipientsService, 'getById'>;
export type ManualSendSender = Pick<DevotionalSender, 'sendEach'>;

export class NoRecipientsSelectedError extends Error {
  constructor() {
    super('Selecione ao menos um destinatário.');
    this.name = 'NoRecipientsSelectedError';
  }
}

export class WhatsAppDisconnectedError extends Error {
  constructor() {
    super('WhatsApp desconectado. Conecte o WhatsApp antes de enviar.');
    this.name = 'WhatsAppDisconnectedError';
  }
}

export class ReadingNotFoundError extends Error {
  constructor(date: string) {
    super(`Não há leitura cadastrada para ${date}.`);
    this.name = 'ReadingNotFoundError';
  }
}

const toSendTarget = ({ chatId, name, type }: Recipient): SendTarget => ({ chatId, name, type });

const NOT_DELIVERED_ERROR = 'A leitura não foi entregue pelo WhatsApp.';

const toResult = (recipient: Recipient, sent: SendResult): ManualSendResult => {
  const base = { recipientId: recipient.id, name: recipient.name, warnings: sent.warnings };
  if (!sent.delivered) return { ...base, status: 'failed', error: NOT_DELIVERED_ERROR };
  return { ...base, status: sent.warnings.length > 0 ? 'sent_with_warnings' : 'sent' };
};

const notFound = (recipientId: number): ManualSendResult => ({
  recipientId,
  name: '',
  status: 'failed',
  warnings: [],
  error: 'Destinatário não encontrado'
});

export class ManualSendService {
  constructor(
    private readonly connection: ManualSendConnection,
    private readonly readings: ManualSendReadings,
    private readonly recipients: ManualSendRecipients,
    private readonly sender: ManualSendSender
  ) {}

  public async send(date: string, recipientIds: number[]): Promise<ManualSendResult[]> {
    if (recipientIds.length === 0) throw new NoRecipientsSelectedError();
    if (!this.connection.getConnectionStatus()) throw new WhatsAppDisconnectedError();
    const reading = await this.readings.getReading(date);
    if (!reading) throw new ReadingNotFoundError(date);
    const uniqueIds = [...new Set(recipientIds)];
    const resolved = await Promise.all(uniqueIds.map(async (id) => ({ id, recipient: await this.recipients.getById(id) })));
    const found = resolved.flatMap(({ recipient }) => (recipient ? [recipient] : []));
    const sent = await this.sender.sendEach(reading, found.map(toSendTarget));
    const resultsById = new Map(found.map((recipient, index) => [recipient.id, toResult(recipient, sent[index]!)]));
    return resolved.map(({ id }) => resultsById.get(id) ?? notFound(id));
  }
}
