# Xưởng Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local web app that walks the user through 6 steps (skill → topic → script → images/layouts → voice → render) and produces a video using the two existing skill workspaces.

**Architecture:** A small Express server (`server.js`) exposes a JSON API and serves a no-build vanilla-JS front end from `public/`. Each skill is an entry in `skills.json` plus a "kind" adapter (`src/kinds/story.js`, `src/kinds/office.js`) that knows that skill's JSON format, script prompt, and render pipeline. Projects are the skill's own `videos/<id>.json` files in its workspace; app-only data lives beside them in `videos/<id>.app.json`. Long work (AI images, voice, render) runs as one in-memory job at a time, streamed to the browser with Server-Sent Events.

**Tech Stack:** Node 20 (ES modules), Express 4, `node:test` + `node:assert`, vanilla JS/CSS in the browser, child processes for `claude`, `python`, `node` scripts of the workspaces.

**Spec:** `docs/superpowers/specs/2026-10-17-xuong-video-design.md`

## Global Constraints

- Listen on `127.0.0.1:5170` only.
- UI text in Vietnamese with full diacritics.
- Never send `.env` contents or keys to the browser or logs shown in the UI.
- Workspaces: story `D:\ke-chuyen-video`, office `C:\Users\admin\ai-van-phong-video`. Skill dirs: `C:\Users\admin\.claude\skills\<id>`.
- Spawn workspace tools with `process.execPath` (node) or `python` and an argument array, never through a shell; Remotion via `node_modules/@remotion/cli/remotion-cli.js`, tsx via `node_modules/tsx/dist/cli.mjs` (office only). Set `PYTHONIOENCODING=utf-8` for python.
- Script writing: `claude -p --tools "" --output-format json --no-session-persistence --strict-mcp-config`, prompt on stdin, timeout 5 minutes.
- Only one job runs at a time (CIT Voice Studio handles one request at a time); a second start returns HTTP 409 with `"Đang tạo một video khác, chờ xong rồi thử lại."`.
- Colours from the mockups: navy `#0c1730`, accent `#d79a2b`, background `#eef1f6`. Mockups: `D:\video-motion\.superpowers\mockups\` (`style.css` is reusable).

## Review Focus

- Claude returns prose or a fenced block around the JSON, or invalid JSON → the topic step shows "Không đọc được kịch bản Claude trả về, bấm viết lại." and keeps the topic; never saves a broken project (test in Task 3).
- Path traversal in `/files/...` and upload file names (`../.env`, absolute paths) → 400, never served or written (tests in Tasks 2 and 6).
- Image provider out of quota (Cloudflare `daily free allocation`, OpenAI `no credits remaining`) → job ends `failed` with the friendly Vietnamese message from the spec, existing images untouched (test in Task 4).
- CIT Voice Studio closed → voice list still returns the Edge voices with `citOnline: false`; a CIT-voice render fails fast with "Mở CIT Voice Studio rồi thử lại." (tests in Tasks 5 and 4).
- Editing the script after a render → generated fields (story `timeline`; office `audio`, `audioSec`, `words`, stretched `durationSec`) are reset so the next render regenerates voice instead of reusing stale timing (test in Task 2).

---

### Task 1: Server skeleton and skill registry

**Files:**
- Create: `package.json`, `server.js`, `skills.json`, `src/skills.js`, `start-xuong-video.bat`, `.gitignore`
- Test: `test/skills.test.js`

**Interfaces:**
- Produces: `loadSkills(file = 'skills.json') -> Skill[]`; `getSkill(id) -> Skill` (throws `Error('Không có skill <id>')`); `createApp() -> express.Application` exported from `server.js` (server only listens when run directly).
- `Skill = { id, name, description, kind: 'story'|'office', workspace, skillDir, wordsPerMinute, defaultVoice, step4: 'images'|'layouts', sampleImage }`.

- [ ] **Step 1: Write `skills.json`** with the two skills: story → `kind:"story"`, `step4:"images"`, `wordsPerMinute:188`, `defaultVoice:{engine:"cit",voice:"Thiện Minh",speed:0.8}`, `sampleImage:"public/story_002/hook_01.png"`; office → `kind:"office"`, `step4:"layouts"`, `wordsPerMinute:165`, `defaultVoice:{engine:"edge",voice:"vi-VN-HoaiMyNeural",rate:"+8%"}`, `sampleImage:null`. Descriptions copied from the mockup `0-chon-skill.html`.
- [ ] **Step 2: Write failing tests**: `loadSkills` returns 2 skills with the fields above; `getSkill('x')` throws; `loadSkills` on a fixture whose workspace is missing marks `available:false` instead of throwing; `GET /api/skills` (via `createApp()` on an ephemeral port) returns the list without `workspace`/`skillDir` paths.
- [ ] **Step 3: Run `node --test`**, expect failures.
- [ ] **Step 4: Implement.** `package.json`: `"type":"module"`, scripts `start: node server.js`, `test: node --test`, dependency `express@^4`. `start-xuong-video.bat`: `cd /d %~dp0`, `start "" http://127.0.0.1:5170`, `node server.js`. `.gitignore`: `node_modules`.
- [ ] **Step 5: Run `node --test`**, expect PASS; `npm start` prints `Xưởng Video: http://127.0.0.1:5170`.
- [ ] **Step 6: Commit** `feat: server skeleton and skill registry`.

### Task 2: Kind adapters and project store

**Files:**
- Create: `src/kinds/story.js`, `src/kinds/office.js`, `src/kinds/index.js`, `src/projects.js`, `src/safePath.js`
- Test: `test/projects.test.js`, `test/kinds.test.js`, fixtures under `test/fixtures/` (copy `_sample.json` of each skill, without `timeline`/audio fields)

**Interfaces:**
- Produces from each kind module:
  - `newId(existingIds: string[], topic: string) -> string` — story `story_NNN` (next number, 3 digits); office slug from topic (lowercase, no diacritics, `-`, max 60 chars, `-2` suffix if taken).
  - `editableScenes(video) -> {index, name, voice, keywords}[]` (office `name` = scene `type`).
  - `applyScriptEdits(video, edits) -> video` — edits `{index, voice?, keywords?}[]`, plus story `hook` lines.
  - `resetGenerated(video) -> video` — story: delete `timeline`; office: delete `audio`, `audioSec`, `words` per scene and set `durationSec` to `hook:3, cta:4, text:5, tip:6`, any other type `6`.
  - `applyVoice(video, {engine, voice, speed?, rate?}) -> video` — story writes `video.tts`; office writes `ttsEngine`, `ttsVoice`, `ttsSpeed` (cit) or `ttsRate` (edge).
  - `estimateSeconds(video, wordsPerMinute) -> number` — spoken words (strip `~` and `|`) / wpm × 60 + 0.7 s per scene.
  - `outputs(id) -> { video, thumbnail|null, caption }` — workspace-relative: story `out/<id>/video_<id>.mp4`, `out/<id>/thumbnail_<id>.png`, `out/<id>/facebook_caption.txt`; office `out/<id>.mp4`, `null`, `out/<id>.txt`.
- `src/kinds/index.js`: `kindOf(skill) -> kindModule`.
- `src/safePath.js`: `resolveInside(root, rel) -> absPath` (throws `Error('Đường dẫn không hợp lệ')` on `..`, absolute, or drive-letter paths).
- `src/projects.js`: `listProjects(skill)`, `readProject(skill, id) -> {video, app}`, `writeProject(skill, id, video, app)`, `createProject(skill, topic, options) -> id` (allocates id only). Ignores `_*.json` and `*.app.json` when listing. Writes UTF-8 JSON, 2-space indent, trailing newline.

- [ ] **Step 1: Write failing tests**: `newId(['story_001','story_003'],'x') === 'story_004'`; office `newId([], 'Claude trong Excel, Word!') === 'claude-trong-excel-word'`; `resetGenerated` removes `timeline` (story) and audio fields + resets `durationSec` (office fixture with `audio`, `durationSec: 9.12` on a tip → `6`); `applyVoice` story/office shapes; `estimateSeconds` on the story fixture within 52–62; `resolveInside(root,'../.env')` throws; `listProjects` skips `_sample.json` and `story_003.app.json`; write→read round-trip keeps Vietnamese text.
- [ ] **Step 2: Run `node --test`**, expect failures.
- [ ] **Step 3: Implement** the modules.
- [ ] **Step 4: Run `node --test`**, expect PASS.
- [ ] **Step 5: Commit** `feat: kind adapters and project store`.

### Task 3: Script writer (Claude Code)

**Files:**
- Create: `src/scriptWriter.js`, `src/prompts/story.md`, `src/prompts/office.md`
- Test: `test/scriptWriter.test.js`, fixtures `test/fixtures/claude-*.json`

**Interfaces:**
- Consumes: `Skill`, kind `resetGenerated`.
- Produces:
  - `buildScriptPrompt(skill, {id, topic, options}) -> string` — the template file for the kind, filled with: `SKILL.md` of the skill dir, story also `references/viet-cau-chuyen.md` and `references/anh-va-cam-xuc.md`, the sample JSON (story `template/videos/_sample.json`, office `template/videos/_sample-long.json`) with generated fields removed, the topic, options and `id`. The template tells Claude: only do the writing steps (story Bước 1–4, office Bước 1–3), run nothing, write the caption the skill describes, and reply with exactly one JSON object `{"video": {...}, "caption": "..."}`.
  - `buildRewritePrompt(skill, video, sceneIndex, instruction) -> string` — reply `{"scene": {...}}`.
  - `parseClaudeOutput(stdout: string, key: 'video'|'scene') -> object` — stdout is Claude's `--output-format json` envelope; take `.result`, cut from the first `{` to the last `}`, `JSON.parse`, require `key` (for `video`: `scenes` is a non-empty array). Throws `Error('Không đọc được kịch bản Claude trả về, bấm viết lại.')`.
  - `runClaude(prompt, {spawnFn = spawn, timeoutMs = 300000}) -> Promise<string>` — spawns `claude` with the flags in Global Constraints, writes prompt to stdin, resolves stdout; rejects with stderr tail on non-zero exit and `Error('Claude viết quá lâu (quá 5 phút).')` on timeout.
  - `writeScript(skill, {topic, options}) -> {id, video, caption}` — composes the above, saves via `writeProject` with `app = {topic, options, caption, imageSources: {}, createdAt}`.

- [ ] **Step 1: Write failing tests**: prompt contains the topic, the id, `"video"` and the text of `SKILL.md` (use a fixture skill dir); `parseClaudeOutput` accepts a fenced ```json block inside `.result`, rejects prose-only and a `video` without scenes; `runClaude` with a fake `spawnFn` resolves stdout, rejects on exit code 1, rejects after `timeoutMs: 50`.
- [ ] **Step 2: Run**, expect failures. **Step 3: Implement.** **Step 4: Run**, expect PASS.
- [ ] **Step 5: Manual check**: `node -e` calling `writeScript(getSkill('ke-chuyen-video'), {topic:'biết nói lời cảm ơn'})` produces `videos/story_NNN.json` with 7 scenes; delete it afterwards.
- [ ] **Step 6: Commit** `feat: script writing through Claude Code`.

### Task 4: Job runner and render pipelines

**Files:**
- Create: `src/jobs.js`, `src/pipelines.js`, `src/friendlyErrors.js`
- Test: `test/jobs.test.js`, `test/pipelines.test.js`

**Interfaces:**
- Consumes: `Skill`, `readProject`, kind `outputs`.
- Produces:
  - `Step = { label: string, run: (ctx) => Promise<void> } | { label, cmd: string, args: string[] | ((ctx) => string[]), progress?: 'remotion' }`.
  - `pipelineFor(skill, id, {regenerateImage?: string, imagesOnly?: boolean}) -> Step[]`:
    - story full: `Tạo ảnh còn thiếu` (only if a file in `video.images` is missing in `public/<id>/`), `Giọng đọc + phụ đề` (`python scripts/story_tts.py videos/<id>.json`), `Nhạc nền` (`node scripts/make-story-music.mjs <id> <ceil(timeline.durationSec)+2>`, args read after the previous step), `Dựng video` (`remotion-cli.js render StoryReel out/<id>/video_<id>.mp4 --props=videos/<id>.json`, progress `remotion`), `Ảnh bìa` (`remotion-cli.js still StoryThumb out/<id>/thumbnail_<id>.png --props=videos/<id>.json`), `Caption` (writes `app.caption` to the caption output).
    - story `imagesOnly`: just the image step; `regenerateImage: 'scene_03.png'` deletes that file first.
    - office full: `Giọng đọc` (`python scripts/tts.py videos/<id>.json`), `Kiểm tra kịch bản` (`tsx/dist/cli.mjs scripts/validate.ts videos/<id>.json`), `Dựng video` (`remotion-cli.js render AiVanPhong out/<id>.mp4 --props=videos/<id>.json`, progress `remotion`), `Caption`.
    - Before a CIT voice step, `GET http://127.0.0.1:8001/health`; if unreachable, fail with `"Mở CIT Voice Studio rồi thử lại."`.
  - `startJob(skill, id, steps) -> Job` (throws `Error` with the 409 message if one is running); `getJob(jobId)`; `subscribe(jobId, listener) -> unsubscribe`. `Job = {id, skillId, projectId, status: 'running'|'done'|'failed', steps: {label, status, percent}[], error: string|null, outputs}`. Log lines kept server-side (last 200), not sent raw.
  - `friendlyError(logText) -> string|null`: `/daily free allocation/` → `"Cloudflare đã hết hạn mức tạo ảnh miễn phí hôm nay (làm mới lúc 7 giờ sáng). Bạn có thể tải ảnh lên thay."`; `/no credits remaining/` → `"Tài khoản OpenAI đã hết tiền."`; `/Không kết nối được CIT/` → `"Mở CIT Voice Studio rồi thử lại."`.
  - Remotion progress: last `(\d+)\/(\d+)` match in output lines → `percent`.

- [ ] **Step 1: Write failing tests**: story pipeline labels for a fixture with all images present skip the image step; with one missing include it; music args computed from `timeline.durationSec: 56.4` → `['scripts/make-story-music.mjs','story_x','59']`; office labels; a job of two `node -e` steps ends `done`; a failing step whose stderr contains `daily free allocation` ends `failed` with the Cloudflare message; a second `startJob` while running throws the 409 message; a fake Remotion line `Rendered 450/900` sets `percent` 50.
- [ ] **Step 2: Run**, expect failures. **Step 3: Implement.** **Step 4: Run**, expect PASS.
- [ ] **Step 5: Commit** `feat: job runner and render pipelines`.

### Task 5: Voices

**Files:**
- Create: `src/voices.js`
- Test: `test/voices.test.js`

**Interfaces:**
- Produces: `listVoices({fetchFn}) -> {citOnline: boolean, voices: Voice[]}` with `Voice = {engine:'cit'|'edge', id, gender:'Nam'|'Nữ', region:'Bắc'|'Trung'|'Nam'|null, style, description}` — CIT region/style parsed from `description` ("Nam · Bắc · Phong cách kể chuyện · 48 kHz"), not from the API `region` field (it is wrong for some voices); Edge adds `vi-VN-NamMinhNeural` (Nam) and `vi-VN-HoaiMyNeural` (Nữ), `region:null`, style "Cần mạng".
- `previewVoice({engine, voice, speed, rate, text}) -> Buffer` (mp3): CIT `POST /api/tts/generate` `format:"mp3"`, `seed:1234`; Edge `python -m edge_tts --voice <v> --rate <r> --text <t> --write-media <tmp.mp3>`. Text capped at 200 characters.

- [ ] **Step 1: Write failing tests** with a fake `fetchFn`: CIT online → 25+2 voices, `Quang Sơn` region `Trung`; CIT throws → `citOnline:false` and the 2 Edge voices.
- [ ] **Step 2–4:** run (fail), implement, run (pass).
- [ ] **Step 5: Commit** `feat: voice list and preview`.

### Task 6: HTTP API

**Files:**
- Create: `src/routes.js`, `src/uploads.js`; Modify: `server.js`
- Test: `test/api.test.js`

**Interfaces:**
- Consumes: everything above.
- Produces (all JSON unless noted; errors `{error: "<tiếng Việt>"}`):
  - `GET /api/skills`
  - `GET /api/projects` → `[{skillId, id, title, updatedAt, hasVideo}]`, newest first
  - `POST /api/projects` `{skillId, topic, options}` → `{id, video, caption, estimateSeconds}` (calls `writeScript`)
  - `GET /api/projects/:skillId/:id` → `{video, app, estimateSeconds, images: [{file, prompt, exists, source}]}`
  - `PUT /api/projects/:skillId/:id` `{video, caption?}` → saves; calls `resetGenerated` when any scene `voice`/`keywords`/`type`, or story `hook`/`images`, differ from the stored file
  - `POST /api/projects/:skillId/:id/rewrite-scene` `{index, instruction?}` → `{scene}`
  - `POST /api/projects/:skillId/:id/images/:file` `{dataUrl}` → crops with ffmpeg `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920` into `public/<id>/<file>` (story) or `public/<id>/<file>` + sets `scene.image` (office, query `?scene=<index>`); records `app.imageSources[file]='upload'`; file name must match `^[\w-]+\.(png|jpg|jpeg)$`
  - `POST /api/projects/:skillId/:id/images/generate` `{file?}` → starts the images-only job (`regenerateImage` when `file`), returns `{jobId}`
  - `GET /api/voices`, `POST /api/voices/preview` → `audio/mpeg`
  - `POST /api/projects/:skillId/:id/render` `{voice}` → `applyVoice`, save, start full pipeline → `{jobId}`; 409 if busy
  - `GET /api/jobs/:jobId`, `GET /api/jobs/:jobId/events` (SSE, one `data:` JSON job snapshot per change)
  - `GET /files/:skillId/*` → static from the workspace's `public/` or `out/` only (`resolveInside`); everything else 404
  - JSON body limit `30mb`.

- [ ] **Step 1: Write failing tests** against `createApp()` with fixture workspaces (temp dirs, `skills.json` override via `XUONG_SKILLS` env): list projects; GET a project; PUT with a changed voice clears `timeline`; upload a 10×10 PNG data URL creates a 1080×1920 file (probe with `ffprobe`); upload name `../x.png` → 400; `GET /files/<skill>/../.env` → 404; `GET /files/<skill>/public/<id>/hook_01.png` → 200; render while another job runs → 409. `POST /api/projects` with a stubbed `writeScript` (inject via `createApp({writeScript})`).
- [ ] **Step 2–4:** run (fail), implement, run (pass).
- [ ] **Step 5: Commit** `feat: HTTP API`.

### Task 7: Front end — wizard shell and steps 1–3

**Files:**
- Create: `public/index.html`, `public/style.css` (start from the mockup `style.css`), `public/app.js`, `public/api.js`, `public/steps/skill.js`, `public/steps/topic.js`, `public/steps/script.js`, `public/steps/projects.js`

**Interfaces:**
- `app.js`: `state = {skill, projectId, video, app, images, voice, jobId}`; `go(step)` renders steps `1..6` with the step bar from the mockup (labels: Chọn skill, Chủ đề, Kịch bản, Ảnh / Bố cục, Giọng đọc, Tạo video; step 4 label "Ảnh" or "Bố cục" by `skill.step4`); each step module exports `render(el, state, {go, save, api})`.
- `api.js`: thin `fetch` wrappers for every route in Task 6; non-2xx throws `Error(body.error)`.
- Step 1 matches `0-chon-skill.png`; "Dự án đã làm" list (from `GET /api/projects`) opens a project at step 3.
- Step 2 matches `1-chu-de.png`; while writing show "Claude đang viết kịch bản… (khoảng 30–60 giây)"; on error show the message and keep the topic.
- Step 3 matches `A2-kich-ban.png`: textarea per scene (show `~`/`|` as typed), keywords as comma-separated input, "↻ Viết lại" per scene, live estimate from `estimateSeconds`, story hook lines with red counter above 18 characters. Saving is debounced 800 ms via `PUT`.

- [ ] **Step 1: Implement** the files.
- [ ] **Step 2: Verify in the browser** (`npm start`, open `http://127.0.0.1:5170`): pick each skill, write a script for a topic, edit a scene, reload the page, the edit is still there; the step bar and layout match the mockups.
- [ ] **Step 3: Commit** `feat: wizard shell and steps 1-3`.

### Task 8: Front end — steps 4–6

**Files:**
- Create: `public/steps/images.js`, `public/steps/layouts.js`, `public/steps/voice.js`, `public/steps/render.js`, `public/jobView.js`

**Interfaces:**
- Consumes: Task 6 routes, `state`.
- `jobView.js`: `watchJob(jobId, onUpdate) -> stop` using `EventSource('/api/jobs/<id>/events')`.
- Step 4 images (`A3-anh.png`): one card per `images` entry, preview `/files/<skill>/public/<id>/<file>?t=<mtime>`, tag from `source`/`exists`, ⬆ opens a file picker → data URL → upload, ✨ AI / ↻ start the images job and refresh cards when done, prompt textarea saved into `video.images[i].prompt`. "Tạo tất cả ảnh còn thiếu" button. Job failures show `job.error`.
- Step 4 layouts (`A3b-bo-cuc-van-phong.png`): per scene a type `<select>` over the office scene types (`hook, stats, compare, bullets, steps, code, bignumber, statement, image, tip, text, cta`) and a form for that type's text fields (field lists from the office skill's `SKILL.md` scene table); switching type keeps `voice` and drops fields the new type lacks.
- Step 5 (`A4-giong.png`): filters, ▶ preview plays the first scene's voice text, speed slider (CIT 0.75–1.0, step 0.05) or rate select (Edge −20% … +15%), CIT offline banner "CIT Voice Studio chưa mở — chỉ dùng được giọng Edge."; default from `skill.defaultVoice` or the project's saved voice.
- Step 6 (`A5-tao-video.png`): "▶ Tạo video" posts render, then shows the step list with ✓/●/○ and the render percent bar; on `done` shows `<video controls>` from `/files/...`, download links for video, thumbnail, caption; on `failed` shows `job.error` and a "Thử lại" button. Reopening the page while a job runs reconnects to it (`GET /api/jobs/<id>`).

- [ ] **Step 1: Implement** the files.
- [ ] **Step 2: Verify end to end in the browser:** (a) story skill: new topic, upload one image per scene (Cloudflare may be out of quota), pick "Thiện Minh", render, video plays and downloads; (b) office skill: new topic, change one scene layout, pick an Edge voice, render, video plays. Capture one screenshot per step for the user.
- [ ] **Step 3: Commit** `feat: steps 4-6 and render view`.

### Task 9: README and handoff

**Files:**
- Create: `README.md` (Vietnamese): what it is, `start-xuong-video.bat` / `npm start`, requirements (CIT Voice Studio open, keys in each workspace `.env`, Claude Code signed in), how to add a skill (`skills.json` entry + kind adapter), where files are saved.

- [ ] **Step 1: Write README.** **Step 2:** `node --test` passes. **Step 3: Commit** `docs: README`.
