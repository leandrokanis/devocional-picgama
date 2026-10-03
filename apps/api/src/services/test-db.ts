import { execFileSync } from 'child_process';
import { copyFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { afterAll } from 'vitest';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export type TestDatabase = {
  prisma: PrismaClient;
  dir: string;
  cleanup: () => Promise<void>;
};

let migratedTemplate: string | null = null;

afterAll(() => {
  if (migratedTemplate) rmSync(path.dirname(migratedTemplate), { recursive: true, force: true });
  migratedTemplate = null;
});

const migrateTemplate = (): string => {
  if (migratedTemplate) return migratedTemplate;
  const templateDir = mkdtempSync(path.join(tmpdir(), 'devocional-db-template-'));
  const templatePath = path.join(templateDir, 'template.db');
  execFileSync(path.join(apiRoot, 'node_modules/.bin/prisma'), ['migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: `file:${templatePath}` },
    stdio: 'pipe'
  });
  migratedTemplate = templatePath;
  return templatePath;
};

export const createTestDatabase = (): TestDatabase => {
  const dir = mkdtempSync(path.join(tmpdir(), 'devocional-db-'));
  const dbPath = path.join(dir, 'test.db');
  copyFileSync(migrateTemplate(), dbPath);
  const url = `file:${dbPath}`;
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  return {
    prisma,
    dir,
    cleanup: async () => {
      await prisma.$disconnect();
      rmSync(dir, { recursive: true, force: true });
    }
  };
};
