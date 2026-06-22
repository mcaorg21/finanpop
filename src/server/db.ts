import pg from "pg";

pg.types.setTypeParser(1082, (val: string) => val); // DATE → keep as string "YYYY-MM-DD"
pg.types.setTypeParser(1114, (val: string) => val); // TIMESTAMP → keep as string
pg.types.setTypeParser(1184, (val: string) => val); // TIMESTAMPTZ → keep as string

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export default pool;
