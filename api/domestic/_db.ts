import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

const getEnv = (name: string, fallback = ''): string => {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const getPool = (): mysql.Pool => {
  if (pool) return pool;

  const host = getEnv('DOMESTIC_DB_HOST');
  const port = Number(process.env.DOMESTIC_DB_PORT || 3306);
  const user = getEnv('DOMESTIC_DB_USER');
  const password = getEnv('DOMESTIC_DB_PASSWORD');
  const database = getEnv('DOMESTIC_DB_NAME');

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    connectionLimit: 8,
    waitForConnections: true,
    charset: 'utf8mb4',
  });

  return pool;
};

export const parseJsonField = <T>(value: unknown, fallback: T): T => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (value == null) return fallback;
  if (Array.isArray(value) || typeof value === 'object') {
    return value as T;
  }
  return fallback;
};
