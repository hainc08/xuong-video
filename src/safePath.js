import {isAbsolute, relative, resolve} from 'node:path';

// Resolve `rel` under `root`, refusing anything that would escape it (.., absolute or drive paths).
export const resolveInside = (root, rel) => {
  if (typeof rel !== 'string' || !rel || isAbsolute(rel) || /^[a-zA-Z]:/.test(rel) || rel.startsWith('/') || rel.startsWith('\\')) {
    throw new Error('Đường dẫn không hợp lệ');
  }
  const abs = resolve(root, rel);
  const back = relative(resolve(root), abs);
  if (!back || back.startsWith('..') || isAbsolute(back)) throw new Error('Đường dẫn không hợp lệ');
  return abs;
};

// Project ids and file names are plain names: letters, digits, _ and -.
export const assertPlainName = (name) => {
  if (!/^[\w-]+$/.test(name ?? '')) throw new Error('Tên không hợp lệ');
  return name;
};
