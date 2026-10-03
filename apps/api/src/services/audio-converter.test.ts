import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { FfmpegAudioConverter } from './audio-converter.js';

let dir: string;

const fakeFfmpeg = (script: string) => {
  const binPath = path.join(dir, 'fake-ffmpeg');
  writeFileSync(binPath, `#!/bin/sh\n${script}\n`);
  chmodSync(binPath, 0o755);
  return binPath;
};

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'devocional-ffmpeg-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('FfmpegAudioConverter', () => {
  test('converts the input to a mono 32k opus voice note at the output path', async () => {
    const binPath = fakeFfmpeg('for last; do :; done; echo "$@" > "$last"');
    const output = path.join(dir, 'out.ogg');
    await new FfmpegAudioConverter(binPath).toVoiceNote('/in/file.mp3', output);
    expect(readFileSync(output, 'utf-8').trim()).toBe(
      `-y -i /in/file.mp3 -vn -c:a libopus -b:a 32k -ac 1 -ar 48000 -application voip -f ogg ${output}`
    );
  });

  test('rejects with the ffmpeg stderr when it exits with a non-zero code', async () => {
    const binPath = fakeFfmpeg('echo "Invalid data found when processing input" >&2; exit 1');
    await expect(
      new FfmpegAudioConverter(binPath).toVoiceNote('/in/file.mp3', path.join(dir, 'out.ogg'))
    ).rejects.toThrow('Invalid data found when processing input');
  });

  test('rejects with "ffmpeg not found" when the binary is missing', async () => {
    const converter = new FfmpegAudioConverter(path.join(dir, 'missing-ffmpeg'));
    await expect(converter.toVoiceNote('/in/file.mp3', path.join(dir, 'out.ogg'))).rejects.toThrow('ffmpeg not found');
  });
});
