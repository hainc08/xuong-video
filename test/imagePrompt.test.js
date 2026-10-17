import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBatchImagePrompt} from '../src/imagePrompt.js';

const story = JSON.parse(readFileSync(new URL('./fixtures/story.json', import.meta.url), 'utf8'));

test('the batch prompt starts with a character reference and lists every image in order with its file name', () => {
  const text = buildBatchImagePrompt(story);
  assert.match(text, /ẢNH 0 — character_ref\.png/);
  story.images.forEach(({file}, i) => assert.match(text, new RegExp(`ẢNH ${i + 1} — ${file.replace('.', '\\.')}`)));
  assert.ok(text.indexOf(story.images[0].file) < text.indexOf(story.images.at(-1).file));
});

test('the batch prompt carries the character, the style and each image description once', () => {
  const text = buildBatchImagePrompt(story);
  assert.ok(text.includes(story.character));
  assert.ok(text.includes(story.images[2].prompt));
  assert.equal(text.split(story.character).length - 1, 1);
});

test('the batch prompt tells ChatGPT how many images, to keep the same person and to wait for "tiếp"', () => {
  const text = buildBatchImagePrompt(story);
  assert.match(text, new RegExp(`Tôi cần ${story.images.length + 1} ảnh`));
  assert.match(text, /CÙNG MỘT NHÂN VẬT/);
  assert.match(text, /"tiếp"/);
});

test('a story without images is refused', () => {
  assert.throws(() => buildBatchImagePrompt({...story, images: []}), /chưa có danh sách ảnh/);
});
