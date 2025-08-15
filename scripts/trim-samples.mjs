#!/usr/bin/env node
/**
 * Trim sample MP3s to short excerpts (default 25s) to keep repository lean.
 * Requires ffmpeg (bundled via ffmpeg-static). Non-destructive: overwrites original only if trimmed version smaller.
 * Env vars:
 *  TRIM_SECONDS=25  duration of excerpt
 *  TRIM_OFFSET=0    start offset seconds
 */
import { stat, rename } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const samplesDir = path.resolve(process.cwd(), 'src/assets/samples');
const MAX_DURATION = parseFloat(process.env.TRIM_SECONDS || '25');
const START_OFFSET = parseFloat(process.env.TRIM_OFFSET || '0');

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', code => code === 0 ? resolve(undefined) : reject(new Error(cmd + ' exited ' + code)));
  });
}

async function maybeTrim(file) {
  const full = path.join(samplesDir, file);
  const tmp = path.join(samplesDir, file.replace(/\.mp3$/i, '_excerpt_tmp.mp3'));
  const args = [
    '-y',
    '-ss', START_OFFSET.toString(),
    '-i', full,
    '-t', MAX_DURATION.toString(),
    '-c', 'copy',
    tmp
  ];
  await run(ffmpegPath, args);
  const origSize = (await stat(full)).size;
  const newSize = (await stat(tmp)).size;
  if (newSize < origSize) {
    await rename(tmp, full);
    console.log('Trimmed', file, '->', (newSize/1024).toFixed(1)+'KB');
  } else {
    console.log('No size reduction for', file, 'keeping original');
  }
}

(async () => {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: trim-samples.mjs <file1.mp3> [file2.mp3...] (relative to src/assets/samples)');
    process.exit(1);
  }
  for (const f of files) {
    try { await maybeTrim(f); } catch (e) { console.warn('Failed to trim', f, e.message); }
  }
})();
