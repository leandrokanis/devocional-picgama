import { prisma } from '../prisma.js';

export type RecipientType = 'group' | 'person';

export interface Recipient {
  id: number;
  chatId: string;
  name: string;
  type: RecipientType;
  createdAt: string;
  updatedAt: string;
}

const toRecipient = (value: {
  id: number;
  chatId: string;
  name: string;
  type: string;
  createdAt: Date;
  updatedAt: Date;
}): Recipient => ({
  id: value.id,
  chatId: value.chatId,
  name: value.name,
  type: value.type as RecipientType,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString()
});

export class RecipientsService {
  public async getAll(): Promise<Recipient[]> {
    const rows = await prisma.recipient.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toRecipient);
  }

  public async getById(id: number): Promise<Recipient | null> {
    const row = await prisma.recipient.findUnique({ where: { id } });
    return row ? toRecipient(row) : null;
  }

  public async create(chatId: string, name: string, type: RecipientType): Promise<Recipient> {
    if (!chatId.trim()) throw new Error('chatId is required');
    if (!name.trim()) throw new Error('name is required');
    if (type !== 'group' && type !== 'person') throw new Error('type must be group or person');
    const row = await prisma.recipient.create({
      data: {
        chatId: chatId.trim(),
        name: name.trim(),
        type
      }
    });
    return toRecipient(row);
  }

  public async update(id: number, chatId: string, name: string, type: RecipientType): Promise<Recipient> {
    if (!chatId.trim()) throw new Error('chatId is required');
    if (!name.trim()) throw new Error('name is required');
    if (type !== 'group' && type !== 'person') throw new Error('type must be group or person');
    const current = await prisma.recipient.findUnique({ where: { id } });
    if (!current) throw new Error('Recipient not found');
    const row = await prisma.recipient.update({
      where: { id },
      data: {
        chatId: chatId.trim(),
        name: name.trim(),
        type
      }
    });
    return toRecipient(row);
  }

  public async delete(id: number): Promise<boolean> {
    const current = await prisma.recipient.findUnique({ where: { id } });
    if (!current) return false;
    await prisma.recipient.delete({ where: { id } });
    return true;
  }
}
