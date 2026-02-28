import { join } from 'path';
import { mkdirSync } from 'fs';
import Database from 'better-sqlite3';
import { logger } from '../utils/logger.js';
import type { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export class WhatsAppAuthService {
  private db: InstanceType<typeof Database>;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const databasePath = join(process.cwd(), 'data', 'whatsapp_auth.db');
    const dir = databasePath.slice(0, databasePath.lastIndexOf('/'));
    mkdirSync(dir, { recursive: true });
    this.db = new Database(databasePath);
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_creds (
        session_id TEXT NOT NULL PRIMARY KEY,
        creds TEXT NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS whatsapp_keys (
        session_id TEXT NOT NULL,
        key_id TEXT NOT NULL,
        key_data TEXT NOT NULL,
        PRIMARY KEY (session_id, key_id)
      )
    `);

    logger.info('WhatsApp auth database initialized');
  }

  public async useAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const creds = await this.loadCreds();
    const keys = await this.loadKeys();

    const saveCreds = async () => {
      await this.saveCreds(creds);
    };

    const keysMap = keys as Record<string, Record<string, unknown>>;
    return {
      state: {
        creds,
        keys: {
          get: async (type, ids) => {
            const result: { [id: string]: any } = {};
            for (const id of ids) {
              if (keysMap[type]?.[id]) {
                result[id] = keysMap[type][id];
              } else {
                const key = await this.getKey(type, id);
                if (key) {
                  if (!keysMap[type]) {
                    keysMap[type] = {};
                  }
                  keysMap[type][id] = key;
                  result[id] = key;
                }
              }
            }
            return result;
          },
          set: async (data: Record<string, Record<string, unknown>>) => {
            for (const category in data) {
              if (!keysMap[category]) {
                keysMap[category] = {};
              }
              for (const jid in data[category]) {
                const value = data[category][jid];
                keysMap[category][jid] = value;
                if (value === null) {
                  await this.removeKey(category as keyof SignalDataTypeMap, jid);
                  delete keysMap[category][jid];
                } else {
                  await this.saveKey(category as keyof SignalDataTypeMap, jid, value);
                }
              }
            }
          }
        }
      },
      saveCreds
    };
  }

  private async loadCreds(): Promise<any> {
    const row = this.db
      .prepare('SELECT creds FROM whatsapp_creds WHERE session_id = ?')
      .get(this.sessionId) as { creds: string } | undefined;

    if (row) {
      try {
        return JSON.parse(row.creds, BufferJSON.reviver);
      } catch (error) {
        logger.error('Failed to parse credentials', error);
        return initAuthCreds();
      }
    }

    return initAuthCreds();
  }

  private async saveCreds(creds: any): Promise<void> {
    const credsJson = JSON.stringify(creds, BufferJSON.replacer);
    this.db
      .prepare('INSERT OR REPLACE INTO whatsapp_creds (session_id, creds) VALUES (?, ?)')
      .run(this.sessionId, credsJson);
  }

  private async loadKeys(): Promise<{ [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] } }> {
    const rows = this.db
      .prepare('SELECT key_id, key_data FROM whatsapp_keys WHERE session_id = ?')
      .all(this.sessionId) as Array<{ key_id: string; key_data: string }>;

    const keys: Record<string, Record<string, unknown>> = {};

    for (const row of rows) {
      const parts = row.key_id.split(':');
      const type = parts[0];
      const id = parts[1];
      if (!type || !id) continue;
      if (!keys[type]) {
        keys[type] = {};
      }
      try {
        keys[type][id] = JSON.parse(row.key_data, BufferJSON.reviver);
      } catch (error) {
        logger.error(`Failed to parse key ${row.key_id}`, error);
      }
    }

    return keys as { [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] } };
  }

  private async getKey(type: keyof SignalDataTypeMap, id: string): Promise<any | null> {
    const keyId = `${type}:${id}`;
    const row = this.db
      .prepare('SELECT key_data FROM whatsapp_keys WHERE session_id = ? AND key_id = ?')
      .get(this.sessionId, keyId) as { key_data: string } | undefined;

    if (row) {
      try {
        return JSON.parse(row.key_data, BufferJSON.reviver);
      } catch (error) {
        logger.error(`Failed to parse key ${keyId}`, error);
        return null;
      }
    }

    return null;
  }

  private async saveKey(
    type: keyof SignalDataTypeMap,
    id: string,
    value: any
  ): Promise<void> {
    const keyId = `${type}:${id}`;
    const keyData = JSON.stringify(value, BufferJSON.replacer);
    this.db
      .prepare('INSERT OR REPLACE INTO whatsapp_keys (session_id, key_id, key_data) VALUES (?, ?, ?)')
      .run(this.sessionId, keyId, keyData);
  }

  private async removeKey(type: keyof SignalDataTypeMap, id: string): Promise<void> {
    const keyId = `${type}:${id}`;
    this.db
      .prepare('DELETE FROM whatsapp_keys WHERE session_id = ? AND key_id = ?')
      .run(this.sessionId, keyId);
  }

  public async clearAuth(): Promise<void> {
    this.db.prepare('DELETE FROM whatsapp_creds WHERE session_id = ?').run(this.sessionId);
    this.db.prepare('DELETE FROM whatsapp_keys WHERE session_id = ?').run(this.sessionId);
    logger.info('WhatsApp auth data cleared');
  }
}
