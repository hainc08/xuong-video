import express from 'express';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadSkills, publicSkill} from './src/skills.js';
import {apiRouter} from './src/routes.js';

const APP_DIR = dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = 5170;

export const createApp = (deps = {}) => {
  const app = express();
  app.use(express.json({limit: '30mb'}));
  app.get('/api/skills', (_req, res) => res.json(loadSkills().map(publicSkill)));
  app.use(apiRouter(deps));
  app.use(express.static(join(APP_DIR, 'public')));
  // Bad JSON bodies and other unhandled errors still answer in the API's {error} shape.
  app.use((err, _req, res, _next) => res.status(err.status ?? 500).json({error: err.type === 'entity.parse.failed' ? 'Dữ liệu gửi lên không hợp lệ' : err.message}));
  return app;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  createApp().listen(PORT, HOST, () => console.log(`Xưởng Video: http://${HOST}:${PORT}`));
}
