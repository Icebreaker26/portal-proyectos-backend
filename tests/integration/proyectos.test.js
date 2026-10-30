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

    test('POST rechaza título de más de 200 caracteres con 400', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'a'.repeat(201), descripcion: 'Descripción válida' });
      expect(res.status).toBe(400);
    });

    test('POST rechaza descripción de más de 5000 caracteres con 400', async () => {
      const res = await agent
        .post('/api/proyectos')
        .send({ titulo: 'Título válido', descripcion: 'a'.repeat(5001) });
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

  describe('Visibilidad de GET /api/proyectos', () => {
    const EMAIL_OTRO = 'proyectos-test-otro@portal.ucp.test';
    let otroUuid, propioPendienteId, otroAprobadoId, otroPendienteId;

    beforeAll(async () => {
      const hash = await bcrypt.hash(PASS, 10);
      const { rows } = await pool.query(
        `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
         VALUES ('Test Otro Estudiante', $1, $2, 'estudiante')
         ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
         RETURNING id`,
        [EMAIL_OTRO, hash],
      );
      otroUuid = rows[0].id;

      const propio = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Propio pendiente', 'd', 'pendiente') RETURNING id`,
        [usuarioUuid],
      );
      propioPendienteId = propio.rows[0].id;

      const aprobado = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Otro aprobado', 'd', 'aprobado') RETURNING id`,
        [otroUuid],
      );
      otroAprobadoId = aprobado.rows[0].id;

      const pendiente = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Otro pendiente', 'd', 'pendiente') RETURNING id`,
        [otroUuid],
      );
      otroPendienteId = pendiente.rows[0].id;
    });

    afterAll(async () => {
      await pool.query('DELETE FROM proyectos WHERE autor_uuid = $1 OR id = $2', [otroUuid, propioPendienteId]);
      await pool.query('DELETE FROM global_usuarios WHERE id = $1', [otroUuid]);
    });

    test('Estudiante ve lo propio (en cualquier estado) y lo aprobado de otros, no lo pendiente de otros', async () => {
      const res = await agent.get('/api/proyectos');
      expect(res.status).toBe(200);
      const ids = res.body.map((p) => p.id);
      expect(ids).toContain(propioPendienteId);
      expect(ids).toContain(otroAprobadoId);
      expect(ids).not.toContain(otroPendienteId);
    });

    test('El listado incluye el conteo de votos de cada proyecto', async () => {
      const res = await agent.get('/api/proyectos');
      const propio = res.body.find((p) => p.id === propioPendienteId);
      expect(propio).toHaveProperty('votos', 0);
    });
  });

  describe('GET /pub/:id — detalle público', () => {
    let aprobadoId, pendienteId;

    beforeAll(async () => {
      const aprobado = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, repositorio_url, estado)
         VALUES ($1, 'Detalle de prueba', 'Descripción de detalle', 'https://github.com/ejemplo/repo', 'aprobado')
         RETURNING id`,
        [usuarioUuid],
      );
      aprobadoId = aprobado.rows[0].id;

      await pool.query(
        `INSERT INTO votos (usuario_uuid, proyecto_id) VALUES ($1, $2)`,
        [usuarioUuid, aprobadoId],
      );

      const pendiente = await pool.query(
        `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
         VALUES ($1, 'Pendiente de prueba', 'd', 'pendiente') RETURNING id`,
        [usuarioUuid],
      );
      pendienteId = pendiente.rows[0].id;
    });

    test('Responde sin autenticación con el detalle, autor y conteo de votos', async () => {
      const res = await request(app).get(`/api/proyectos/pub/${aprobadoId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: aprobadoId,
        titulo: 'Detalle de prueba',
        autor_nombre: 'Test Estudiante',
        votos: 1,
      });
    });

    test('Responde 404 para un proyecto que no existe', async () => {
      const res = await request(app).get('/api/proyectos/pub/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });

    test('Responde 404 para un proyecto pendiente (no aprobado)', async () => {
      const res = await request(app).get(`/api/proyectos/pub/${pendienteId}`);
      expect(res.status).toBe(404);
    });

    test('Responde 400 si el id no es un UUID válido', async () => {
      const res = await request(app).get('/api/proyectos/pub/no-es-un-uuid');
      expect(res.status).toBe(400);
    });
  });
});
