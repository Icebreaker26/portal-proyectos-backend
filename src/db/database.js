import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

const pool = new Pool({ connectionString: env.DATABASE_URL });

export default pool;
