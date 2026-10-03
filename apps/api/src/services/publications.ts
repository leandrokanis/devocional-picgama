import type { Prisma, PrismaClient } from '@prisma/client';

export type PublicationTarget = { chatId: string; groupName: string };

export type Publication = PublicationTarget & { publishedAt: Date };

export class PublicationsService {
  constructor(private readonly prisma: PrismaClient) {}

  public async record(date: string, target: PublicationTarget): Promise<void> {
    await this.prisma.readingPublication.create({
      data: { readingDate: date, chatId: target.chatId, groupName: target.groupName }
    });
  }

  public async summaries(dates?: string[]): Promise<Record<string, Date>> {
    const groups = await this.prisma.readingPublication.groupBy({
      by: ['readingDate'],
      where: dates ? { readingDate: { in: dates } } : {},
      _min: { publishedAt: true }
    });
    return Object.fromEntries(
      groups.flatMap((group) => (group._min.publishedAt ? [[group.readingDate, group._min.publishedAt]] : []))
    );
  }

  public async listFor(date: string): Promise<Publication[]> {
    return this.prisma.readingPublication.findMany({
      where: { readingDate: date },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: { chatId: true, groupName: true, publishedAt: true }
    });
  }

  public async moveDate(from: string, to: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.readingPublication.updateMany({ where: { readingDate: from }, data: { readingDate: to } });
  }

  public async removeFor(date: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.readingPublication.deleteMany({ where: { readingDate: date } });
  }
}
