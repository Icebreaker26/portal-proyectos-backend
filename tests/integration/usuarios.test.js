import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL_ADMIN = 'usuarios-test-admin@portal.ucp.test';
const EMAIL_ESTUDIANTE = 'usuarios-test-estudiante@portal.ucp.test';
const EMAIL_PROFESOR = 'usuarios-test-profesor@portal.ucp.test';
const EMAIL_SIN_PERMISO = 'usuarios-test-sinpermiso@portal.ucp.test';
const PASS = 'testpass123';

let app, adminAgent, estudianteAgent, profesorUuid, sinPermisoAgent, adminUuid, estudianteUuid, sinPermisoUuid;

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

  // Issue #12 — 'usuarios'/'BUSCAR' además de los permisos de 'proyectos' que ya tenía este test.
  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE (m.nombre = 'proyectos' AND a.nombre IN ('READ', 'WRITE'))
        OR (m.nombre = 'usuarios' AND a.nombre = 'BUSCAR')
     ON CONFLICT DO NOTHING`,
    [estudianteUuid],
  );

  const profesor = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Profesor Buscable', $1, $2, 'profesor')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'profesor'
     RETURNING id`,
    [EMAIL_PROFESOR, hash],
  );
  profesorUuid = profesor.rows[0].id;

  // Usuario sin ningún permiso de 'usuarios' — para el caso 403 de /profesores y /buscar.
  const sinPermiso = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Sin Permiso Usuarios', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'estudiante'
     RETURNING id`,
    [EMAIL_SIN_PERMISO, hash],
  );
  sinPermisoUuid = sinPermiso.rows[0].id;

  adminAgent = request.agent(app);
  await adminAgent.post('/api/auth/login').send({ email: EMAIL_ADMIN, password: PASS });

  estudianteAgent = request.agent(app);
  await estudianteAgent.post('/api/auth/login').send({ email: EMAIL_ESTUDIANTE, password: PASS });

  sinPermisoAgent = request.agent(app);
  await sinPermisoAgent.post('/api/auth/login').send({ email: EMAIL_SIN_PERMISO, password: PASS });
});

afterAll(async () => {
  await pool.query('DELETE FROM permisos WHERE usuario_uuid IN ($1, $2, $3, $4)', [
    adminUuid, estudianteUuid, profesorUuid, sinPermisoUuid,
  ]);
  await pool.query('DELETE FROM global_usuarios WHERE id IN ($1, $2, $3, $4)', [
    adminUuid, estudianteUuid, profesorUuid, sinPermisoUuid,
  ]);
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

  describe('Issue #12 — listar profesores y buscar por email', () => {
    test('GET /profesores rechaza sin cookie', async () => {
      const res = await request(app).get('/api/usuarios/profesores');
      expect(res.status).toBe(401);
    });

    test('GET /profesores rechaza a quien no tiene el permiso BUSCAR', async () => {
      const res = await sinPermisoAgent.get('/api/usuarios/profesores');
      expect(res.status).toBe(403);
    });

    test('GET /profesores devuelve al profesor sembrado, sin password_hash', async () => {
      const res = await estudianteAgent.get('/api/usuarios/profesores');
      expect(res.status).toBe(200);
      const fila = res.body.find((u) => u.email === EMAIL_PROFESOR);
      expect(fila).toMatchObject({ id: profesorUuid, email: EMAIL_PROFESOR });
      expect(fila).not.toHaveProperty('password_hash');
    });

    test('GET /buscar rechaza un email inválido con 400', async () => {
      const res = await estudianteAgent.get('/api/usuarios/buscar').query({ email: 'no-es-un-email' });
      expect(res.status).toBe(400);
    });

    test('GET /buscar responde 404 si el email no existe', async () => {
      const res = await estudianteAgent
        .get('/api/usuarios/buscar')
        .query({ email: 'no-existe-nadie-con-este-email@portal.ucp.test' });
      expect(res.status).toBe(404);
    });

    test('GET /buscar encuentra la cuenta por email exacto, sin importar mayúsculas', async () => {
      const res = await estudianteAgent
        .get('/api/usuarios/buscar')
        .query({ email: EMAIL_PROFESOR.toUpperCase() });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ id: profesorUuid, email: EMAIL_PROFESOR });
    });

    test('GET /buscar rechaza a quien no tiene el permiso BUSCAR', async () => {
      const res = await sinPermisoAgent.get('/api/usuarios/buscar').query({ email: EMAIL_PROFESOR });
      expect(res.status).toBe(403);
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
