import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {buildScriptPrompt, buildRewritePrompt, parseClaudeOutput, runClaude} from '../src/scriptWriter.js';

const fixtureSkill = () => {
  const skillDir = mkdtempSync(join(tmpdir(), 'xv-skill-'));
  writeFileSync(join(skillDir, 'SKILL.md'), '# Hướng dẫn đặc biệt XYZ\nViết 7 cảnh.');
  mkdirSync(join(skillDir, 'references'));
  writeFileSync(join(skillDir, 'references', 'viet-cau-chuyen.md'), 'Ký hiệu ~ nối từ ghép.');
  writeFileSync(join(skillDir, 'references', 'anh-va-cam-xuc.md'), 'Ánh sáng theo cảm xúc.');
  mkdirSync(join(skillDir, 'template', 'videos'), {recursive: true});
  writeFileSync(join(skillDir, 'template', 'videos', '_sample.json'), JSON.stringify({id: 'story_001', scenes: [{voice: 'mẫu'}], timeline: {durationSec: 1}}));
  return {id: 'ke-chuyen-video', kind: 'story', skillDir, workspace: skillDir};
};

const envelope = (result) => JSON.stringify({type: 'result', subtype: 'success', is_error: false, result});

test('the script prompt carries the skill guide, sample, topic and id', () => {
  const prompt = buildScriptPrompt(fixtureSkill(), {id: 'story_009', topic: 'biết nói lời cảm ơn', options: {duration: 60}});
  assert.match(prompt, /Hướng dẫn đặc biệt XYZ/);
  assert.match(prompt, /Ký hiệu ~ nối từ ghép/);
  assert.match(prompt, /biết nói lời cảm ơn/);
  assert.match(prompt, /story_009/);
  assert.match(prompt, /"video"/);
  assert.doesNotMatch(prompt, /durationSec/); // the sample's generated timeline is stripped
});

test('the office prompt carries the schema limits so Claude stays inside them', () => {
  const skillDir = mkdtempSync(join(tmpdir(), 'xv-office-'));
  writeFileSync(join(skillDir, 'SKILL.md'), '# Mẹo AI');
  mkdirSync(join(skillDir, 'template', 'videos'), {recursive: true});
  mkdirSync(join(skillDir, 'template', 'src'), {recursive: true});
  writeFileSync(join(skillDir, 'template', 'videos', '_sample-long.json'), JSON.stringify({scenes: [{type: 'hook', voice: 'x'}]}));
  writeFileSync(join(skillDir, 'template', 'src', 'schema.ts'), 'value: z.string().max(14)');
  const prompt = buildScriptPrompt({id: 'ai-van-phong-video', kind: 'office', skillDir, workspace: skillDir}, {id: 'meo-a', topic: 'email'});
  assert.match(prompt, /z\.string\(\)\.max\(14\)/);
});

test('the rewrite prompt names the scene to rewrite and asks for {"scene"}', () => {
  const prompt = buildRewritePrompt(fixtureSkill(), {scenes: [{voice: 'a'}, {voice: 'b'}]}, 1, 'ngắn hơn');
  assert.match(prompt, /cảnh số 2/);
  assert.match(prompt, /ngắn hơn/);
  assert.match(prompt, /"scene"/);
});

test('parseClaudeOutput reads JSON inside a fenced block in the result', () => {
  const out = parseClaudeOutput(envelope('Đây là kịch bản:\n```json\n{"video": {"scenes": [{"voice": "x"}]}, "caption": "c"}\n```'), 'video');
  assert.equal(out.video.scenes[0].voice, 'x');
  assert.equal(out.caption, 'c');
});

test('parseClaudeOutput rejects prose without JSON', () => {
  assert.throws(() => parseClaudeOutput(envelope('Xin lỗi, tôi không làm được.'), 'video'), /Không đọc được kịch bản Claude trả về, bấm viết lại\./);
});

test('parseClaudeOutput rejects a video without scenes', () => {
  assert.throws(() => parseClaudeOutput(envelope('{"video": {"scenes": []}}'), 'video'), /Không đọc được kịch bản/);
});

const fakeSpawn = ({stdout = '', stderr = '', code = 0, delay = 5} = {}) => {
  const calls = [];
  const fn = (cmd, args) => {
    const child = new EventEmitter();
    child.stdin = new PassThrough();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => child.emit('close', null);
    let input = '';
    child.stdin.on('data', (d) => (input += d));
    calls.push({cmd, args, input: () => input});
    if (delay >= 0) {
      setTimeout(() => {
        child.stdout.end(stdout);
        child.stderr.end(stderr);
        child.emit('close', code);
      }, delay);
    }
    return child;
  };
  fn.calls = calls;
  return fn;
};

test('runClaude sends the prompt on stdin with tools disabled and resolves stdout', async () => {
  const spawnFn = fakeSpawn({stdout: envelope('{}')});
  const out = await runClaude('xin chào', {spawnFn});
  assert.equal(out, envelope('{}'));
  const {args, input} = spawnFn.calls[0];
  assert.deepEqual(args.slice(0, 3), ['-p', '--tools', '']);
  assert.ok(args.includes('--output-format') && args.includes('json'));
  assert.equal(input(), 'xin chào');
});

test('runClaude rejects with the stderr tail on a non-zero exit', async () => {
  await assert.rejects(runClaude('x', {spawnFn: fakeSpawn({stderr: 'not logged in', code: 1})}), /not logged in/);
});

test('runClaude gives up after the timeout', async () => {
  await assert.rejects(runClaude('x', {spawnFn: fakeSpawn({delay: -1}), timeoutMs: 50}), /Claude viết quá lâu/);
});
