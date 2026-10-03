export type RecipientType = 'group' | 'person';

export interface Recipient {
  id: number;
  chatId: string;
  name: string;
  type: RecipientType;
  createdAt: string;
  updatedAt: string;
}

export interface DevotionalAudio {
  originalName: string;
  sizeBytes: number;
  durationSeconds: number | null;
  updatedAt: string;
}

export type ReadingStatus = 'ready' | 'pending';

export interface DevotionalReading {
  date: string;
  passage: string;
  title: string;
  description: string;
  link: string;
  audio: DevotionalAudio | null;
  status: ReadingStatus;
  updatedAt: string;
}

export interface ReadingInput {
  date: string;
  passage: string;
  title?: string;
  description?: string;
  link?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
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
