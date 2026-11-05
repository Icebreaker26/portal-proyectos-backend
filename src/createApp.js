import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const cargarModulos = async (app) => {
  const modulesDir = path.join(__dirname, 'modules');
  const nombres = fs.readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  for (const nombre of nombres) {
    const routesPath = path.join(modulesDir, nombre, 'routes', `${nombre}Routes.js`);
    if (!fs.existsSync(routesPath)) continue;
    const { default: router } = await import(`./modules/${nombre}/routes/${nombre}Routes.js`);
    app.use(`/api/${nombre}`, router);
  }
};

export const createApp = async () => {
  const app = express();

  // ADR 0004: el backend siempre corre detrás de un reverse proxy (nginx del frontend),
  // tanto en docker-compose local como en el destino cloud final — nunca expuesto directo.
  // Confiar en el primer hop es necesario para que express-rate-limit lea la IP real desde
  // X-Forwarded-For en vez de lanzar ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // CSRF simple: toda mutación debe llevar el header que apiService siempre manda.
  app.use((req, res, next) => {
    const metodosMutables = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (env.NODE_ENV !== 'test' && metodosMutables.includes(req.method) && req.headers['x-requested-with'] !== 'XMLHttpRequest') {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
    next();
  });

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

  await cargarModulos(app);

  app.use(errorHandler);

  return app;
};
