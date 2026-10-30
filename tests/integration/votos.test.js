import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');

let app;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await pool.end();
});

describe('Votos — Integración', () => {
  describe('Auth', () => {
    test('Debe rechazar voto sin cookie', async () => {
      const res = await request(app).post('/api/votos').send({ proyecto_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(401);
    });
  });

  // TODO (issue "Tests de integración: núcleo + proyectos + votos"):
  // completar CRUD de votos y la regla "un voto por usuario por proyecto"
  // una vez exista el seed de usuario + proyecto de prueba.
});
