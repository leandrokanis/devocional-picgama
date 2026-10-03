import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { FfmpegAudioConverter, parseFfmpegDuration } from './audio-converter.js';

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

  test('resolves with the duration that ffmpeg printed on stderr', async () => {
    const binPath = fakeFfmpeg('echo "  Duration: 00:01:05.40, start: 0.000000, bitrate: 64 kb/s" >&2; exit 0');
    const result = await new FfmpegAudioConverter(binPath).toVoiceNote('/in/file.mp3', path.join(dir, 'out.ogg'));
    expect(result).toEqual({ durationSeconds: 65 });
  });

  test('a successful conversion without a Duration line resolves with a null duration instead of failing', async () => {
    const binPath = fakeFfmpeg('echo "no duration here" >&2; exit 0');
    const result = await new FfmpegAudioConverter(binPath).toVoiceNote('/in/file.mp3', path.join(dir, 'out.ogg'));
    expect(result).toEqual({ durationSeconds: null });
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

describe('parseFfmpegDuration', () => {
  test.each([
    { stderr: '  Duration: 00:03:25.50, start: 0.025057, bitrate: 128 kb/s', expected: 206 },
    { stderr: '  Duration: 00:03:25.49, start: 0.025057, bitrate: 128 kb/s', expected: 205 },
    { stderr: '  Duration: 01:02:03.00, start: 0.000000', expected: 3723 },
    { stderr: 'Input #0, mp3, from \'x.mp3\':', expected: null },
    { stderr: '  Duration: N/A, bitrate: N/A', expected: null }
  ])('reads "$stderr" as $expected seconds', ({ stderr, expected }) => {
    expect(parseFfmpegDuration(stderr)).toBe(expected);
  });
});
