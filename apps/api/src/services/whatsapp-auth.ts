import type { AuthenticationState, SignalDataTypeMap } from '@whiskeysockets/baileys';
import { BufferJSON, initAuthCreds } from '@whiskeysockets/baileys';
import { prisma } from '../prisma.js';
import { logger } from '../utils/logger.js';

export class WhatsAppAuthService {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  public async useAuthState(): Promise<{
    state: AuthenticationState;
    saveCreds: () => Promise<void>;
  }> {
    const creds = await this.loadCreds();
    const keys = await this.loadKeys();
    const keysMap = keys as Record<string, Record<string, unknown>>;

    return {
      state: {
        creds: creds as AuthenticationState['creds'],
        keys: {
          get: async (type, ids) => {
            const result: Record<string, unknown> = {};
            for (const id of ids) {
              if (keysMap[type]?.[id]) {
                result[id] = keysMap[type][id];
                continue;
              }
              const key = await this.getKey(type, id);
              if (key) {
                if (!keysMap[type]) keysMap[type] = {};
                keysMap[type][id] = key;
                result[id] = key;
              }
            }
            return result as { [id: string]: SignalDataTypeMap[typeof type] };
          },
          set: async (data: Record<string, Record<string, SignalDataTypeMap[keyof SignalDataTypeMap] | null>>) => {
            for (const category in data) {
              if (!keysMap[category]) keysMap[category] = {};
              for (const jid in data[category]) {
                const value = data[category][jid];
                if (value === null) {
                  await this.removeKey(category as keyof SignalDataTypeMap, jid);
                  delete keysMap[category][jid];
                } else {
                  keysMap[category][jid] = value;
                  await this.saveKey(category as keyof SignalDataTypeMap, jid, value);
                }
              }
            }
          }
        }
      },
      saveCreds: async () => this.saveCreds(creds)
    };
  }

  private async loadCreds(): Promise<AuthenticationState['creds']> {
    const row = await prisma.whatsAppCreds.findUnique({
      where: {
        sessionId: this.sessionId
      }
    });
    if (!row) return initAuthCreds();
    try {
      return JSON.parse(row.creds, BufferJSON.reviver);
    } catch (error) {
      logger.error('Failed to parse credentials', error);
      return initAuthCreds();
    }
  }

  private async saveCreds(creds: AuthenticationState['creds']): Promise<void> {
    await prisma.whatsAppCreds.upsert({
      where: {
        sessionId: this.sessionId
      },
      create: {
        sessionId: this.sessionId,
        creds: JSON.stringify(creds, BufferJSON.replacer)
      },
      update: {
        creds: JSON.stringify(creds, BufferJSON.replacer)
      }
    });
  }

  private async loadKeys(): Promise<{ [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] } }> {
    const rows = await prisma.whatsAppKey.findMany({
      where: {
        sessionId: this.sessionId
      }
    });
    const keys: Record<string, Record<string, unknown>> = {};
    for (const row of rows) {
      const parts = row.keyId.split(':');
      const type = parts[0];
      const id = parts[1];
      if (!type || !id) continue;
      if (!keys[type]) keys[type] = {};
      try {
        keys[type][id] = JSON.parse(row.keyData, BufferJSON.reviver);
      } catch (error) {
        logger.error(`Failed to parse key ${row.keyId}`, error);
      }
    }
    return keys as { [T in keyof SignalDataTypeMap]: { [id: string]: SignalDataTypeMap[T] } };
  }

  private async getKey(type: keyof SignalDataTypeMap, id: string): Promise<unknown | null> {
    const keyId = `${type}:${id}`;
    const row = await prisma.whatsAppKey.findUnique({
      where: {
        sessionId_keyId: {
          sessionId: this.sessionId,
          keyId
        }
      }
    });
    if (!row) return null;
    try {
      return JSON.parse(row.keyData, BufferJSON.reviver);
    } catch (error) {
      logger.error(`Failed to parse key ${keyId}`, error);
      return null;
    }
  }

  private async saveKey(type: keyof SignalDataTypeMap, id: string, value: unknown): Promise<void> {
    const keyId = `${type}:${id}`;
    await prisma.whatsAppKey.upsert({
      where: {
        sessionId_keyId: {
          sessionId: this.sessionId,
          keyId
        }
      },
      create: {
        sessionId: this.sessionId,
        keyId,
        keyData: JSON.stringify(value, BufferJSON.replacer)
      },
      update: {
        keyData: JSON.stringify(value, BufferJSON.replacer)
      }
    });
  }

  private async removeKey(type: keyof SignalDataTypeMap, id: string): Promise<void> {
    const keyId = `${type}:${id}`;
    await prisma.whatsAppKey.deleteMany({
      where: {
        sessionId: this.sessionId,
        keyId
      }
    });
  }

  public async clearAuth(): Promise<void> {
    await prisma.whatsAppCreds.deleteMany({ where: { sessionId: this.sessionId } });
    await prisma.whatsAppKey.deleteMany({ where: { sessionId: this.sessionId } });
  }
}
