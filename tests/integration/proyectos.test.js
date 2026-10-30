import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL = 'proyectos-test@portal.ucp.test';
const PASS = 'testpass123';

let app, agent, usuarioUuid;

beforeAll(async () => {
  app = await createApp();

  const hash = await bcrypt.hash(PASS, 10);
  const { rows } = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Estudiante', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL, hash],
  );
  usuarioUuid = rows[0].id;

  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE', 'DELETE')
     ON CONFLICT DO NOTHING`,
    [usuarioUuid],
  );

  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASS });
});

afterAll(async () => {
  await pool.query('DELETE FROM proyectos WHERE autor_uuid = $1', [usuarioUuid]);
  await pool.query('DELETE FROM permisos WHERE usuario_uuid = $1', [usuarioUuid]);
  await pool.query('DELETE FROM global_usuarios WHERE id = $1', [usuarioUuid]);
  await pool.end();
});

describe('Proyectos — Integración', () => {
  describe('Auth', () => {
    test('Debe rechazar sin cookie', async () => {
      const res = await request(app).get('/api/proyectos');
      expect(res.status).toBe(401);
    });
  });

  describe('Pública', () => {
    test('GET /pub responde sin autenticación', async () => {
      const res = await request(app).get('/api/proyectos/pub');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('Validación', () => {
    test('POST rechaza body inválido con 400', async () => {
      const res = await agent.post('/api/proyectos').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('CRUD', () => {
    let proyectoId;

    test('POST crea proyecto', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Proyecto de prueba', descripcion: 'Descripción de prueba' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      proyectoId = res.body.id;
    });

    test('DELETE hace borrado lógico', async () => {
      const res = await agent.delete(`/api/proyectos/${proyectoId}`);
      expect(res.status).toBe(200);

      const { rows } = await pool.query('SELECT is_active FROM proyectos WHERE id = $1', [proyectoId]);
      expect(rows[0].is_active).toBe(false);
    });
  });
});
