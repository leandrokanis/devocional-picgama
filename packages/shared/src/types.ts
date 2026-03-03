export type RecipientType = 'group' | 'person';

export interface Recipient {
  id: number;
  chatId: string;
  name: string;
  type: RecipientType;
  createdAt: string;
  updatedAt: string;
}

export interface DevotionalReading {
  date: string;
  reading: string;
}

export interface HealthResponse {
  status: string;
  connected: boolean;
  hasQRCode: boolean;
  scheduler: { running: boolean };
}

export interface SchedulerStatus {
  running: boolean;
  nextExecution?: string;
  sendTime: string;
  timezone: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
