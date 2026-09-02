import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "node:fs";

const connectionConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 5000),
};
const database = (process.env.DB_NAME || "rw_kita").replace(/[^\w]/g, "");
let pool;
let initialization;

export async function initializeDatabase() {
  if (pool) return pool;
  if (initialization) return initialization;

  initialization = (async () => {
    let bootstrap;
    try {
      bootstrap = await mysql.createConnection(connectionConfig);
      await bootstrap.query("CREATE DATABASE IF NOT EXISTS " + database + " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      const nextPool = mysql.createPool({ ...connectionConfig, database, waitForConnections: true, connectionLimit: 10, queueLimit: 0, enableKeepAlive: true });
      const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
      for (const statement of schema.split(";").map((item) => item.trim()).filter(Boolean)) await nextPool.query(statement);
      pool = nextPool;
      console.log("[MySQL] Terhubung ke database:", database);
      return pool;
    } finally {
      await bootstrap?.end().catch(() => undefined);
    }
  })();

  try {
    return await initialization;
  } catch (error) {
    initialization = undefined;
    throw error;
  }
}

export async function query(sql, values = []) {
  const activePool = pool || await initializeDatabase();
  const [rows] = await activePool.execute({ sql, timeout: 8000 }, values);
  return rows;
}

export function databaseReady() {
  return Boolean(pool);
}
