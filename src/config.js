import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULTS = {libraryDir: 'D:\\xuong-video-thu-vien'};

// App settings from config.json; XUONG_LIBRARY overrides the library folder (tests, other machines).
export const loadConfig = () => {
  const file = join(APP_DIR, 'config.json');
  const saved = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const config = {...DEFAULTS, ...saved};
  if (process.env.XUONG_LIBRARY) config.libraryDir = process.env.XUONG_LIBRARY;
  return config;
};
