import { createApp } from './createApp.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';

const app = await createApp();

app.listen(env.PORT, () => {
  logger.info(`Portal de Proyectos backend escuchando en :${env.PORT}`);
});
