import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');

const EMAIL = 'auth-test@ucp.edu.co';
const PASS = 'testpass123';

let app;

beforeAll(async () => {
  app = await createApp();
});

afterAll(async () => {
  await pool.query('DELETE FROM permisos WHERE usuario_uuid IN (SELECT id FROM global_usuarios WHERE email = $1)', [EMAIL]);
  await pool.query('DELETE FROM global_usuarios WHERE email = $1', [EMAIL]);
  await pool.end();
});

describe('Auth — Integración', () => {
  describe('Validación Zod', () => {
    test('POST /registro rechaza correo fuera de @ucp.edu.co con 400', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({ nombre: 'Test', email: 'auth-test@gmail.com', password: PASS });
      expect(res.status).toBe(400);
    });

    test('POST /registro rechaza contraseña corta con 400', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({ nombre: 'Test', email: EMAIL, password: 'corta' });
      expect(res.status).toBe(400);
    });

    test('POST /login rechaza body inválido con 400', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'no-es-un-correo' });
      expect(res.status).toBe(400);
    });
  });

  describe('Registro', () => {
    let usuarioUuid;

    test('POST /registro crea cuenta con rol estudiante y setea cookie', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({ nombre: 'Test Auth', email: EMAIL, password: PASS });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ email: EMAIL, rol: 'estudiante' });
      expect(res.headers['set-cookie']?.[0]).toMatch(/^token=/);
      usuarioUuid = res.body.id;
    });

    test('El usuario registrado recibe los permisos por defecto de estudiante', async () => {
      const { rows } = await pool.query(
        `SELECT a.nombre FROM permisos p
           JOIN acciones a ON a.id = p.accion_id
          WHERE p.usuario_uuid = $1 ORDER BY a.nombre`,
        [usuarioUuid],
      );
      expect(rows.map((r) => r.nombre)).toEqual(
        expect.arrayContaining(['READ', 'WRITE']),
      );
    });

    test('POST /registro con el mismo correo responde 409', async () => {
      const res = await request(app)
        .post('/api/auth/registro')
        .send({ nombre: 'Test Auth Duplicado', email: EMAIL, password: PASS });
      expect(res.status).toBe(409);
    });
  });

  describe('Login / sesión', () => {
    let agent;

    test('POST /login con credenciales inválidas responde 401', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'incorrecta' });
      expect(res.status).toBe(401);
    });

    test('POST /login con correo inexistente responde 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'no-existe@ucp.edu.co', password: PASS });
      expect(res.status).toBe(401);
    });

    test('POST /login con credenciales correctas responde 200 y setea cookie', async () => {
      agent = request.agent(app);
      const res = await agent.post('/api/auth/login').send({ email: EMAIL, password: PASS });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: EMAIL, rol: 'estudiante' });
    });

    test('GET /me sin cookie responde 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    test('GET /me con cookie devuelve el usuario de la sesión', async () => {
      const res = await agent.get('/api/auth/me');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ email: EMAIL, rol: 'estudiante' });
    });

    test('POST /logout limpia la cookie y /me vuelve a fallar', async () => {
      const logoutRes = await agent.post('/api/auth/logout');
      expect(logoutRes.status).toBe(200);

      const meRes = await agent.get('/api/auth/me');
      expect(meRes.status).toBe(401);
    });
  });
});
