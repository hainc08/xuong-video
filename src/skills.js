import {existsSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// XUONG_SKILLS lets tests (or a second setup) point at another skills.json.
export const loadSkills = (file = process.env.XUONG_SKILLS || join(APP_DIR, 'skills.json')) =>
  JSON.parse(readFileSync(file, 'utf8')).map((s) => ({...s, available: existsSync(s.workspace)}));

export const getSkill = (id) => {
  const skill = loadSkills().find((s) => s.id === id);
  if (!skill) throw new Error(`Không có skill ${id}`);
  return skill;
};

// What the browser may see: no local paths.
export const publicSkill = ({workspace, skillDir, ...rest}) => rest;
