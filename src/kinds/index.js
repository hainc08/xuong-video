import * as story from './story.js';
import * as office from './office.js';

const KINDS = {story, office};

export const kindOf = (skill) => {
  const kind = KINDS[skill.kind];
  if (!kind) throw new Error(`Chưa hỗ trợ loại skill "${skill.kind}"`);
  return kind;
};
