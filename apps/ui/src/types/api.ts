import type { DevotionalReading, Recipient, SchedulerStatus } from '@devocional/shared';

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
    filteredBy?: string;
  };
};

export type QrResponse = {
  success: boolean;
  connected: boolean;
  qr: string | null;
  message: string;
};
