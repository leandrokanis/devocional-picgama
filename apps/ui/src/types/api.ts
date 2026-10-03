import type { DevotionalReading, ImportResult, ManualSendResult, Recipient, SchedulerStatus } from '@devocional/shared';

export type HealthResponse = {
  status: string;
  connected: boolean;
  hasQRCode: boolean;
  scheduler: SchedulerStatus;
};

export type RecipientsResponse = {
  data: Recipient[];
};

export type ReadingsResponse = {
  data: DevotionalReading[];
  metadata: {
    count: number;
    range?: { from?: string; to?: string };
  };
};

export type ReadingResponse = {
  success: boolean;
  data: DevotionalReading;
};

export type ImportReadingsResponse = ImportResult & {
  success: boolean;
};

export type QrResponse = {
  success: boolean;
  connected: boolean;
  qr: string | null;
  message: string;
};

export type ManualSendResponse = {
  success: boolean;
  data: ManualSendResult[];
};
