// Writes a video script by running Claude Code on this machine with the skill's own guide.
import {spawn} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {kindOf} from './kinds/index.js';
import {createProject, writeProject} from './projects.js';

const PROMPTS = join(dirname(fileURLToPath(import.meta.url)), 'prompts');
const PARSE_ERROR = 'Không đọc được kịch bản Claude trả về, bấm viết lại.';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';

// Files each kind reads from the skill folder: references are optional extras, the sample shows the JSON shape.
const SKILL_FILES = {
  story: {references: ['references/viet-cau-chuyen.md', 'references/anh-va-cam-xuc.md'], sample: 'template/videos/_sample.json'},
  office: {references: [], sample: 'template/videos/_sample-long.json'},
};

const read = (skill, rel) => readFileSync(join(skill.skillDir, rel), 'utf8');

const stripGenerated = (video) => {
  const v = structuredClone(video);
  delete v.timeline;
  delete v.ttsVoice;
  delete v.ttsRate;
  for (const s of v.scenes ?? []) {
    delete s.audio;
    delete s.audioSec;
    delete s.words;
  }
  return v;
};

const guide = (skill) => {
  const files = SKILL_FILES[skill.kind];
  const references = files.references
    .filter((rel) => existsSync(join(skill.skillDir, rel)))
    .map((rel) => `===== ${rel} =====\n${read(skill, rel)}`)
    .join('\n\n');
  const sample = JSON.stringify(stripGenerated(JSON.parse(read(skill, files.sample))), null, 2);
  return {skill: read(skill, 'SKILL.md'), references, sample};
};

const fill = (template, values) => template.replace(/\{\{(\w+)\}\}/g, (_, k) => values[k] ?? '');

export const buildScriptPrompt = (skill, {id, topic, options = {}}) => {
  const g = guide(skill);
  return fill(readFileSync(join(PROMPTS, `${skill.kind}.md`), 'utf8'), {
    TOPIC: topic,
    OPTIONS: JSON.stringify(options),
    ID: id,
    SKILL: g.skill,
    REFERENCES: g.references,
    SAMPLE: g.sample,
  });
};

export const buildRewritePrompt = (skill, video, sceneIndex, instruction = '') => {
  const g = guide(skill);
  return [
    `Bạn đang sửa kịch bản video của skill "${skill.id}". Viết lại cảnh số ${sceneIndex + 1} (phần tử thứ ${sceneIndex} của "scenes"), giữ nguyên mạch câu chuyện và các cảnh khác.`,
    instruction ? `Yêu cầu của người dùng: ${instruction}` : 'Người dùng chưa ưng cảnh này, hãy viết một phiên bản tốt hơn.',
    'Không chạy lệnh nào. Trả lời bằng ĐÚNG MỘT đối tượng JSON: {"scene": <cảnh mới, cùng cấu trúc cảnh cũ>}.',
    `===== KỊCH BẢN HIỆN TẠI =====\n${JSON.stringify(stripGenerated(video), null, 2)}`,
    `===== HƯỚNG DẪN SKILL (SKILL.md) =====\n${g.skill}`,
    g.references,
  ].join('\n\n');
};

export const parseClaudeOutput = (stdout, key) => {
  let text = stdout;
  try {
    const envelope = JSON.parse(stdout);
    if (typeof envelope?.result === 'string') text = envelope.result;
  } catch {
    // not the --output-format json envelope: treat stdout as the answer itself
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(PARSE_ERROR);
  let data;
  try {
    data = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(PARSE_ERROR);
  }
  const value = data?.[key];
  if (!value || typeof value !== 'object') throw new Error(PARSE_ERROR);
  if (key === 'video' && !(Array.isArray(value.scenes) && value.scenes.length)) throw new Error(PARSE_ERROR);
  return data;
};

export const runClaude = (prompt, {spawnFn = spawn, timeoutMs = 300000} = {}) =>
  new Promise((resolve, reject) => {
    const args = ['-p', '--tools', '', '--output-format', 'json', '--no-session-persistence', '--strict-mcp-config'];
    const child = spawnFn(CLAUDE_BIN, args, {windowsHide: true});
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (fn, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error('Claude viết quá lâu (quá 5 phút).'));
      child.kill();
    }, timeoutMs);
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', (e) => finish(reject, new Error(`Không chạy được Claude Code: ${e.message}`)));
    child.on('close', (code) => {
      if (code === 0) finish(resolve, stdout);
      else finish(reject, new Error(`Claude Code báo lỗi: ${(stderr || stdout).trim().slice(-400)}`));
    });
    child.stdin.end(prompt);
  });

export const writeScript = async (skill, {topic, options = {}}, {run = runClaude} = {}) => {
  const id = createProject(skill, topic);
  const {video, caption = ''} = parseClaudeOutput(await run(buildScriptPrompt(skill, {id, topic, options})), 'video');
  const clean = kindOf(skill).resetGenerated(video);
  if (skill.kind === 'story') clean.id = id; // story scripts key their image folder on "id"
  writeProject(skill, id, clean, {topic, options, caption, imageSources: {}, createdAt: new Date().toISOString()});
  return {id, video: clean, caption};
};

export const rewriteScene = async (skill, video, sceneIndex, instruction, {run = runClaude} = {}) =>
  parseClaudeOutput(await run(buildRewritePrompt(skill, video, sceneIndex, instruction)), 'scene').scene;
