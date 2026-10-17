// Voices from CIT Voice Studio (local) and Edge TTS, plus short previews.
import {spawn} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const CIT = 'http://127.0.0.1:8001';
const PREVIEW_MAX = 200;

const EDGE_VOICES = [
  {engine: 'edge', id: 'vi-VN-NamMinhNeural', gender: 'Nam', region: null, style: 'Cần mạng', description: 'Giọng Edge nam · cần internet'},
  {engine: 'edge', id: 'vi-VN-HoaiMyNeural', gender: 'Nữ', region: null, style: 'Cần mạng', description: 'Giọng Edge nữ · cần internet'},
];

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Description looks like "Nam · Bắc · Phong cách kể chuyện · 48 kHz". The API "region" field is wrong
// for some voices (Quang Sơn is Trung), so read gender, region and style from the description.
const fromCit = (v) => {
  const [gender, region, style = ''] = (v.description ?? '').split('·').map((s) => s.trim());
  return {
    engine: 'cit',
    id: v.id,
    gender,
    region: ['Bắc', 'Trung', 'Nam'].includes(region) ? region : null,
    style: capitalize(style.replace(/^(Phong cách|Giọng đọc)\s*/i, '')),
    description: v.description ?? '',
  };
};

export const listVoices = async ({fetchFn = fetch} = {}) => {
  try {
    const health = await (await fetchFn(`${CIT}/health`, {signal: AbortSignal.timeout(3000)})).json();
    if (health.status !== 'ok') throw new Error('not ready');
    const cit = await (await fetchFn(`${CIT}/voices`, {signal: AbortSignal.timeout(5000)})).json();
    return {citOnline: true, voices: [...cit.map(fromCit), ...EDGE_VOICES]};
  } catch {
    return {citOnline: false, voices: [...EDGE_VOICES]};
  }
};

const edgePreview = ({voice, rate = '+0%', text}) =>
  new Promise((resolve, reject) => {
    const dir = mkdtempSync(join(tmpdir(), 'xv-voice-'));
    const out = join(dir, 'preview.mp3');
    const child = spawn('python', ['-m', 'edge_tts', '--voice', voice, `--rate=${rate}`, '--text', text, '--write-media', out], {windowsHide: true});
    let err = '';
    child.stderr.on('data', (d) => (err += d));
    child.on('error', reject);
    child.on('close', (code) => {
      try {
        if (code !== 0) throw new Error(`Edge TTS lỗi: ${err.trim().slice(-200)}`);
        resolve(readFileSync(out));
      } catch (e) {
        reject(e);
      } finally {
        rmSync(dir, {recursive: true, force: true});
      }
    });
  });

export const previewVoice = async ({engine, voice, speed = 1, rate, text}, {fetchFn = fetch} = {}) => {
  const short = String(text ?? '').slice(0, PREVIEW_MAX);
  if (engine === 'edge') return edgePreview({voice, rate, text: short});
  const res = await fetchFn(`${CIT}/api/tts/generate`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text: short, voice_id: voice, speed, format: 'mp3', seed: 1234}),
  });
  if (!res.ok) throw new Error('CIT Voice Studio không tạo được giọng nghe thử.');
  return Buffer.from(await res.arrayBuffer());
};
