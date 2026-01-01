import { join } from 'path';
import { mkdirSync } from 'fs';
import { Database } from 'bun:sqlite';
import { logger } from '../utils/logger.js';

export type RecipientType = 'group' | 'person';

export interface Recipient {
  id: number;
  chatId: string;
  name: string;
  type: RecipientType;
  createdAt: string;
  updatedAt: string;
}

export class RecipientsService {
  private db: Database;

  constructor(dbPath?: string) {
    const databasePath = dbPath || join(process.cwd(), 'data', 'recipients.db');
    const dir = databasePath.slice(0, databasePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    this.db = new Database(databasePath);
  }

  public initialize(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('group', 'person')),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TRIGGER IF NOT EXISTS recipients_update_timestamp
      AFTER UPDATE ON recipients
      BEGIN
        UPDATE recipients SET updated_at = datetime('now') WHERE id = NEW.id;
      END;
    `);
    logger.info('Recipients database initialized');
  }

  public getAll(): Recipient[] {
    const rows = this.db
      .query('SELECT id, chat_id as chatId, name, type, created_at as createdAt, updated_at as updatedAt FROM recipients ORDER BY id ASC')
      .all() as Recipient[];
    return rows;
  }

  public getById(id: number): Recipient | null {
    const row = this.db
      .query('SELECT id, chat_id as chatId, name, type, created_at as createdAt, updated_at as updatedAt FROM recipients WHERE id = ?')
      .get(id) as Recipient | undefined;
    return row || null;
  }

  public create(chatId: string, name: string, type: RecipientType): Recipient {
    if (!chatId.trim()) {
      throw new Error('chatId is required');
    }
    if (!name.trim()) {
      throw new Error('name is required');
    }
    if (type !== 'group' && type !== 'person') {
      throw new Error('type must be group or person');
    }

    const stmt = this.db.query('INSERT INTO recipients (chat_id, name, type) VALUES (?, ?, ?)');
    const result = stmt.run(chatId.trim(), name.trim(), type);

    if (result.changes !== 1) {
      throw new Error('Failed to insert recipient');
    }

    const inserted = this.getById(Number(result.lastInsertRowid));
    if (!inserted) {
      throw new Error('Failed to load inserted recipient');
    }
    return inserted;
  }

  public update(id: number, chatId: string, name: string, type: RecipientType): Recipient {
    if (!chatId.trim()) {
      throw new Error('chatId is required');
    }
    if (!name.trim()) {
      throw new Error('name is required');
    }
    if (type !== 'group' && type !== 'person') {
      throw new Error('type must be group or person');
    }

    const stmt = this.db.query('UPDATE recipients SET chat_id = ?, name = ?, type = ? WHERE id = ?');
    const result = stmt.run(chatId.trim(), name.trim(), type, id);

    if (result.changes !== 1) {
      throw new Error('Recipient not found or not updated');
    }

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to load updated recipient');
    }
    return updated;
  }

  public delete(id: number): boolean {
    const stmt = this.db.query('DELETE FROM recipients WHERE id = ?');
    const result = stmt.run(id);
    return result.changes === 1;
  }
}
