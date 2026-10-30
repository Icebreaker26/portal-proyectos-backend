import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL_ADMIN = 'usuarios-test-admin@portal.ucp.test';
const EMAIL_ESTUDIANTE = 'usuarios-test-estudiante@portal.ucp.test';
const PASS = 'testpass123';

let app, adminAgent, estudianteAgent, adminUuid, estudianteUuid;

beforeAll(async () => {
  app = await createApp();

  const hash = await bcrypt.hash(PASS, 10);

  const admin = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Admin', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'admin'
     RETURNING id`,
    [EMAIL_ADMIN, hash],
  );
  adminUuid = admin.rows[0].id;

  const estudiante = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Estudiante Promovible', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'estudiante'
     RETURNING id`,
    [EMAIL_ESTUDIANTE, hash],
  );
  estudianteUuid = estudiante.rows[0].id;

  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE')
     ON CONFLICT DO NOTHING`,
    [estudianteUuid],
  );

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: EMAIL_ADMIN, password: PASS });

  estudianteAgent = request.agent(app);
  await estudianteAgent.post('/api/auth/login').send({ email: EMAIL_ESTUDIANTE, password: PASS });
});

afterAll(async () => {
  await pool.query('DELETE FROM permisos WHERE usuario_uuid IN ($1, $2)', [adminUuid, estudianteUuid]);
  await pool.query('DELETE FROM global_usuarios WHERE id IN ($1, $2)', [adminUuid, estudianteUuid]);
  await pool.end();
});

describe('Usuarios — Integración', () => {
  describe('Auth', () => {
    test('Debe rechazar sin cookie', async () => {
      const res = await request(app).get('/api/usuarios');
      expect(res.status).toBe(401);
    });

    test('Debe rechazar a un estudiante con 403', async () => {
      const res = await estudianteAgent.get('/api/usuarios');
      expect(res.status).toBe(403);
    });
  });

  describe('Validación Zod', () => {
    test('Debe rechazar rol inválido con 400', async () => {
      const res = await adminAgent.put(`/api/usuarios/${estudianteUuid}/rol`).send({ rol: 'admin' });
      expect(res.status).toBe(400);
    });
  });

  describe('Promoción a profesor', () => {
    test('Admin promueve a estudiante a profesor', async () => {
      const res = await adminAgent.put(`/api/usuarios/${estudianteUuid}/rol`).send({ rol: 'profesor' });
      expect(res.status).toBe(200);
      expect(res.body.rol).toBe('profesor');
    });

    test('El usuario promovido recibe los permisos por defecto de profesor', async () => {
      const { rows } = await pool.query(
        `SELECT a.nombre FROM permisos p
           JOIN acciones a ON a.id = p.accion_id
           JOIN modulos m ON m.id = p.modulo_id
          WHERE p.usuario_uuid = $1 AND m.nombre = 'proyectos' ORDER BY a.nombre`,
        [estudianteUuid],
      );
      const acciones = rows.map((r) => r.nombre);
      expect(acciones).toEqual(expect.arrayContaining(['APROBAR', 'DELETE', 'READ', 'WRITE']));
    });

    test('GET /api/usuarios lista al usuario promovido', async () => {
      const res = await adminAgent.get('/api/usuarios');
      expect(res.status).toBe(200);
      const emails = res.body.map((u) => u.email);
      expect(emails).toContain(EMAIL_ESTUDIANTE);
    });

    test('PUT a un usuario inexistente responde 404', async () => {
      const res = await adminAgent
        .put('/api/usuarios/00000000-0000-0000-0000-000000000000/rol')
        .send({ rol: 'profesor' });
      expect(res.status).toBe(404);
    });
  });
});
