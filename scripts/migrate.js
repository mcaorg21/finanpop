import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });

  try {
    const migrationsDir = path.join(__dirname, "..", "migrations");
    // Sem argumentos roda todas; com nomes de arquivo roda só esses
    // (ex.: node scripts/migrate.js 003_transaction_groups.sql).
    const only = process.argv.slice(2);
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith(".sql"))
      .filter(f => only.length === 0 || only.includes(f))
      .sort();
    if (only.length > 0 && files.length !== only.length) {
      const missing = only.filter(f => !files.includes(f));
      throw new Error(`Migração não encontrada: ${missing.join(", ")}`);
    }

    for (const file of files) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
      await pool.query(sql);
      console.log(`  ✓ ${file} completed`);
    }

    console.log("\nAll migrations completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
