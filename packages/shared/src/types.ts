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

export type ReadingStatus = 'pending' | 'published';

export interface ReadingPublication {
  chatId: string;
  groupName: string;
  publishedAt: string;
}

export interface DevotionalReading {
  date: string;
  passage: string;
  title: string;
  description: string;
  link: string;
  audio: DevotionalAudio | null;
  status: ReadingStatus;
  publishedAt: string | null;
  updatedAt: string;
  publications?: ReadingPublication[];
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

export interface ManualSendRequest {
  recipientIds: number[];
}

export type ManualSendStatus = 'sent' | 'sent_with_warnings' | 'failed';

export interface ManualSendResult {
  recipientId: number;
  name: string;
  status: ManualSendStatus;
  warnings: string[];
  error?: string;
}
