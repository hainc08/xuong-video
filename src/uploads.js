// Save an uploaded image (data URL) as a full-frame 1080x1920 picture.
import {execFile} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {promisify} from 'node:util';

const run = promisify(execFile);
export const IMAGE_NAME = /^[\w-]+\.(png|jpg|jpeg)$/i;

export const saveImage = async (dataUrl, target) => {
  const match = /^data:image\/[\w.+-]+;base64,(.+)$/s.exec(dataUrl ?? '');
  if (!match) throw new Error('Ảnh tải lên không hợp lệ');
  const dir = mkdtempSync(join(tmpdir(), 'xv-up-'));
  try {
    const raw = join(dir, 'upload');
    writeFileSync(raw, Buffer.from(match[1], 'base64'));
    mkdirSync(dirname(target), {recursive: true});
    // Cover the vertical frame: scale up until both sides fill it, then crop the overflow.
    await run('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920', '-frames:v', '1', target], {windowsHide: true});
  } catch (e) {
    throw new Error(e.message.startsWith('Ảnh') ? e.message : 'Không đọc được ảnh tải lên.');
  } finally {
    rmSync(dir, {recursive: true, force: true});
  }
};
