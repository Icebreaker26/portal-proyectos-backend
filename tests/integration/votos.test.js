import { jest } from '@jest/globals';
jest.setTimeout(30000);

const { createApp } = await import('../../src/createApp.js');
const { default: pool } = await import('../../src/db/database.js');
const { default: request } = await import('supertest');
const { default: bcrypt } = await import('bcrypt');

const EMAIL = 'votos-test@portal.ucp.test';
const PASS = 'testpass123';

let app, agent, usuarioUuid, proyectoId;

beforeAll(async () => {
  app = await createApp();

  const hash = await bcrypt.hash(PASS, 10);
  const { rows } = await pool.query(
    `INSERT INTO global_usuarios (nombre, email, password_hash, rol)
     VALUES ('Test Votante', $1, $2, 'estudiante')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    [EMAIL, hash],
  );
  usuarioUuid = rows[0].id;

  await pool.query(
    `INSERT INTO permisos (usuario_uuid, modulo_id, accion_id)
     SELECT $1, m.id, a.id FROM modulos m, acciones a
     WHERE m.nombre = 'votos' AND a.nombre IN ('WRITE', 'DELETE')
     ON CONFLICT DO NOTHING`,
    [usuarioUuid],
  );

  const proyecto = await pool.query(
    `INSERT INTO proyectos (autor_uuid, titulo, descripcion, estado)
     VALUES ($1, 'Proyecto para votar', 'd', 'aprobado') RETURNING id`,
    [usuarioUuid],
  );
  proyectoId = proyecto.rows[0].id;

  agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: EMAIL, password: PASS });
});

afterAll(async () => {
  await pool.query('DELETE FROM votos WHERE usuario_uuid = $1', [usuarioUuid]);
  await pool.query('DELETE FROM proyectos WHERE autor_uuid = $1', [usuarioUuid]);
  await pool.query('DELETE FROM permisos WHERE usuario_uuid = $1', [usuarioUuid]);
  await pool.query('DELETE FROM global_usuarios WHERE id = $1', [usuarioUuid]);
  await pool.end();
});

describe('Votos — Integración', () => {
  describe('Auth', () => {
    test('Debe rechazar voto sin cookie', async () => {
      const res = await request(app).post('/api/votos').send({ proyecto_id: '00000000-0000-0000-0000-000000000000' });
      expect(res.status).toBe(401);
    });
  });

  describe('Validación Zod', () => {
    test('Debe rechazar proyecto_id inválido con 400', async () => {
      const res = await agent.post('/api/votos').send({ proyecto_id: 'no-es-un-uuid' });
      expect(res.status).toBe(400);
    });
  });

  describe('Conteo público', () => {
    test('GET /pub/:proyectoId/conteo responde sin autenticación', async () => {
      const res = await request(app).get(`/api/votos/pub/${proyectoId}/conteo`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 0 });
    });
  });

  describe('CRUD', () => {
    test('POST registra el voto', async () => {
      const res = await agent.post('/api/votos').send({ proyecto_id: proyectoId });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ usuario_uuid: usuarioUuid, proyecto_id: proyectoId, is_active: true });
    });

    test('El conteo público refleja el voto', async () => {
      const res = await request(app).get(`/api/votos/pub/${proyectoId}/conteo`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ total: 1 });
    });

    test('DELETE retira el voto (borrado lógico)', async () => {
      const res = await agent.delete(`/api/votos/${proyectoId}`);
      expect(res.status).toBe(200);

      const { rows } = await pool.query(
        'SELECT is_active FROM votos WHERE usuario_uuid = $1 AND proyecto_id = $2',
        [usuarioUuid, proyectoId],
      );
      expect(rows[0].is_active).toBe(false);
    });

    test('DELETE de un voto inexistente responde 404', async () => {
      const res = await agent.delete('/api/votos/00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);
    });
  });

  describe('Regla: un voto por usuario por proyecto', () => {
    test('Votar de nuevo reactiva el mismo voto en vez de duplicarlo', async () => {
      const res = await agent.post('/api/votos').send({ proyecto_id: proyectoId });
      expect(res.status).toBe(201);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS total FROM votos WHERE usuario_uuid = $1 AND proyecto_id = $2',
        [usuarioUuid, proyectoId],
      );
      expect(rows[0].total).toBe(1);
    });

    test('Votar dos veces seguidas no crea una segunda fila', async () => {
      const res = await agent.post('/api/votos').send({ proyecto_id: proyectoId });
      expect(res.status).toBe(201);

      const { rows } = await pool.query(
        'SELECT COUNT(*)::int AS total FROM votos WHERE usuario_uuid = $1 AND proyecto_id = $2',
        [usuarioUuid, proyectoId],
      );
      expect(rows[0].total).toBe(1);
    });
  });
});
