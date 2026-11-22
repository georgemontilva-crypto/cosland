import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? process.env.MYSQL_URL;
if (!url) {
  console.error("Falta DATABASE_URL (cadena de conexión de MySQL).");
  process.exit(1);
}

export const pool = mysql.createPool({ uri: url, connectionLimit: 10, charset: "utf8mb4", timezone: "Z" });
// Todas las fechas en UTC, sin importar la zona del servidor de base de datos
pool.pool.on("connection", (conn) => conn.query("SET time_zone = '+00:00'"));
export const db = drizzle(pool, { schema, mode: "default" });

// Aplica las migraciones pendientes de ./drizzle al arrancar
export async function runMigrations() {
  await migrate(db, { migrationsFolder: "./drizzle" });
}
