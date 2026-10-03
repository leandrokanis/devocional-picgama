import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export type VoiceNoteResult = { durationSeconds: number | null };

export interface AudioConverter {
  toVoiceNote(inputPath: string, outputPath: string): Promise<VoiceNoteResult>;
}

export class AudioConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioConversionError';
  }
}

const DURATION_PATTERN = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;

export const parseFfmpegDuration = (stderr: string): number | null => {
  const match = DURATION_PATTERN.exec(stderr);
  if (!match) return null;
  const [hours, minutes, seconds] = match.slice(1).map(Number) as [number, number, number];
  return Math.round(hours * 3600 + minutes * 60 + seconds);
};

const VOICE_NOTE_ARGS = ['-vn', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '48000', '-application', 'voip', '-f', 'ogg'];

export class FfmpegAudioConverter implements AudioConverter {
  constructor(private readonly ffmpegPath = 'ffmpeg') {}

  public toVoiceNote(inputPath: string, outputPath: string): Promise<VoiceNoteResult> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.ffmpegPath, ['-y', '-i', inputPath, ...VOICE_NOTE_ARGS, outputPath]);
      let settled = false;
      let stderr = '';
      child.on('error', (error: NodeJS.ErrnoException) => {
        settled = true;
        if (error.code === 'ENOENT') {
          logger.error(`ffmpeg not found (${this.ffmpegPath}); install ffmpeg to convert audio uploads`);
          reject(new AudioConversionError(`ffmpeg not found: ${this.ffmpegPath}`));
          return;
        }
        reject(new AudioConversionError(`ffmpeg failed to start: ${error.message}`));
      });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on('close', (code) => {
        if (settled) return;
        if (code === 0) resolve({ durationSeconds: parseFfmpegDuration(stderr) });
        else reject(new AudioConversionError(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      });
    });
  }
}
