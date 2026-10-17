import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {listVoices, previewVoice} from '../src/voices.js';

const citVoices = JSON.parse(readFileSync(new URL('./fixtures/cit-voices.json', import.meta.url), 'utf8'));
const okFetch = async (url) => ({ok: true, json: async () => (url.endsWith('/health') ? {status: 'ok'} : citVoices)});
const downFetch = async () => {
  throw new Error('ECONNREFUSED');
};

test('with CIT running, the list has every CIT voice plus the two Edge voices', async () => {
  const {citOnline, voices} = await listVoices({fetchFn: okFetch});
  assert.equal(citOnline, true);
  assert.equal(voices.length, citVoices.length + 2);
  assert.equal(voices.filter((v) => v.engine === 'edge').length, 2);
});

test('region and style come from the description, not the API region field', async () => {
  const {voices} = await listVoices({fetchFn: okFetch});
  const quangSon = voices.find((v) => v.id === 'Quang Sơn');
  assert.equal(quangSon.region, 'Trung');
  assert.equal(quangSon.gender, 'Nam');
  const thienMinh = voices.find((v) => v.id === 'Thiện Minh');
  assert.equal(thienMinh.style, 'Kể chuyện');
});

test('with CIT closed, only the Edge voices come back and citOnline is false', async () => {
  const {citOnline, voices} = await listVoices({fetchFn: downFetch});
  assert.equal(citOnline, false);
  assert.deepEqual(voices.map((v) => v.id).sort(), ['vi-VN-HoaiMyNeural', 'vi-VN-NamMinhNeural']);
  assert.equal(voices.find((v) => v.id === 'vi-VN-NamMinhNeural').gender, 'Nam');
});

test('a CIT preview asks for mp3 with a fixed seed and caps the text at 200 characters', async () => {
  let sent;
  const fetchFn = async (url, init) => {
    sent = {url, body: JSON.parse(init.body)};
    return {ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer};
  };
  const audio = await previewVoice({engine: 'cit', voice: 'Thiện Minh', speed: 0.8, text: 'a'.repeat(500)}, {fetchFn});
  assert.match(sent.url, /\/api\/tts\/generate$/);
  assert.equal(sent.body.format, 'mp3');
  assert.equal(sent.body.seed, 1234);
  assert.equal(sent.body.text.length, 200);
  assert.deepEqual([...audio], [1, 2, 3]);
});
