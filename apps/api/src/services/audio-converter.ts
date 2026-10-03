import { spawn } from 'child_process';
import { logger } from '../utils/logger.js';

export interface AudioConverter {
  toVoiceNote(inputPath: string, outputPath: string): Promise<void>;
}

export class AudioConversionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioConversionError';
  }
}

const VOICE_NOTE_ARGS = ['-vn', '-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '48000', '-application', 'voip', '-f', 'ogg'];

export class FfmpegAudioConverter implements AudioConverter {
  constructor(private readonly ffmpegPath = 'ffmpeg') {}

  public toVoiceNote(inputPath: string, outputPath: string): Promise<void> {
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
        if (code === 0) resolve();
        else reject(new AudioConversionError(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      });
    });
  }
}
