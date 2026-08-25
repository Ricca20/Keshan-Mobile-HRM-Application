const { Pool } = require('pg');
const pool = new Pool({ connectionString: "postgresql://postgres.baaevdcdsljbfgqjbsfj:YepdTv2NvUvnHjW1@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres" });
async function main() {
  const client = await pool.connect();
  const res = await client.query('SELECT COUNT(*) FROM "User"');
  console.log("Users in DB:", res.rows);
  client.release();
  pool.end();
}
main().catch(console.error);
