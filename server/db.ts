import pg from "pg";
import { defaultEmailToAgentMap } from "@shared/schema";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_jCf9YEm2JtAd@ep-dark-mouse-a4zuag3d-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Create tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS hub_jobs (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        location TEXT NOT NULL,
        job_url TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'Dice',
        status TEXT NOT NULL DEFAULT 'New',
        agent TEXT NOT NULL,
        employment_type TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(job_url, agent)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id SERIAL PRIMARY KEY,
        agent TEXT NOT NULL,
        run_date DATE DEFAULT CURRENT_DATE,
        jobs_found INTEGER DEFAULT 0,
        sources_searched TEXT,
        status TEXT DEFAULT 'completed',
        completed_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(agent, run_date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS access_mappings (
        email TEXT PRIMARY KEY,
        agent_ids TEXT[] NOT NULL
      );
    `);

    // Seed access_mappings if empty
    const { rows: mappings } = await client.query("SELECT COUNT(*) as count FROM access_mappings");
    if (parseInt(mappings[0].count) === 0) {
      for (const [email, agentIds] of Object.entries(defaultEmailToAgentMap)) {
        await client.query(
          "INSERT INTO access_mappings (email, agent_ids) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
          [email, agentIds]
        );
      }
      console.log("Seeded access_mappings with default data");
    }

    // Migrate data from self_apply_jobs if it exists
    try {
      const { rows: selfApplyExists } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'self_apply_jobs'
        ) as exists
      `);
      if (selfApplyExists[0].exists) {
        await client.query(`
          INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent, employment_type, created_at)
          SELECT title, company, location, job_url, source, status, agent, employment_type, created_at
          FROM self_apply_jobs
          ON CONFLICT (job_url, agent) DO NOTHING
        `);
        console.log("Migrated data from self_apply_jobs");
      }
    } catch (e) {
      console.log("No self_apply_jobs table to migrate from");
    }

    // Migrate data from jobs table (VenuJA1) if it exists
    try {
      const { rows: jobsExists } = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables WHERE table_name = 'jobs'
        ) as exists
      `);
      if (jobsExists[0].exists) {
        // Check columns available in the jobs table
        const { rows: cols } = await client.query(`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs'
        `);
        const colNames = cols.map((c: any) => c.column_name);

        if (colNames.includes("title") && colNames.includes("company")) {
          const sourceCol = colNames.includes("source") ? "source" : "'LinkedIn'";
          const statusCol = colNames.includes("status") ? "status" : "'New'";
          const locationCol = colNames.includes("location") ? "location" : "'Remote'";
          const employmentTypeCol = colNames.includes("employment_type") ? "employment_type" : "NULL";
          const createdAtCol = colNames.includes("created_at") ? "created_at" : "NOW()";
          const jobUrlCol = colNames.includes("job_url") ? "job_url" : colNames.includes("url") ? "url" : "'#'";

          await client.query(`
            INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent, employment_type, created_at)
            SELECT title, company, ${locationCol}, ${jobUrlCol}, ${sourceCol}, ${statusCol}, 'venuja1', ${employmentTypeCol}, ${createdAtCol}
            FROM jobs
            ON CONFLICT (job_url, agent) DO NOTHING
          `);
          console.log("Migrated data from jobs table with agent=venuja1");
        }
      }
    } catch (e) {
      console.log("No jobs table to migrate from:", (e as Error).message);
    }

    console.log("Database initialized successfully");
  } finally {
    client.release();
  }
}
