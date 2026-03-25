import { pool } from "./db";
import type { HubJob, AgentRun, AccessMapping } from "@shared/schema";

export const storage = {
  // Jobs
  async getJobs(agentIds: string[], agentFilter?: string, statusFilter?: string, sourceFilter?: string): Promise<HubJob[]> {
    let query = "SELECT * FROM hub_jobs WHERE agent = ANY($1)";
    const params: any[] = [agentIds];
    let paramIdx = 2;

    if (agentFilter) {
      query += ` AND agent = $${paramIdx}`;
      params.push(agentFilter);
      paramIdx++;
    }
    if (statusFilter) {
      query += ` AND status = $${paramIdx}`;
      params.push(statusFilter);
      paramIdx++;
    }
    if (sourceFilter) {
      query += ` AND source = $${paramIdx}`;
      params.push(sourceFilter);
      paramIdx++;
    }

    query += " ORDER BY created_at DESC";
    const { rows } = await pool.query(query, params);
    return rows;
  },

  async updateJobStatus(id: number, status: string, agentIds: string[]): Promise<HubJob | null> {
    const { rows } = await pool.query(
      "UPDATE hub_jobs SET status = $1 WHERE id = $2 AND agent = ANY($3) RETURNING *",
      [status, id, agentIds]
    );
    return rows[0] || null;
  },

  async getJobStats(agentIds: string[], agentFilter?: string): Promise<Record<string, number>> {
    let query = "SELECT INITCAP(status) as status, COUNT(*) as count FROM hub_jobs WHERE agent = ANY($1)";
    const params: any[] = [agentIds];
    if (agentFilter) {
      query += " AND agent = $2";
      params.push(agentFilter);
    }
    query += " GROUP BY INITCAP(status)";
    const { rows } = await pool.query(query, params);

    const stats: Record<string, number> = {
      total: 0,
      New: 0,
      Applied: 0,
      Interview: 0,
      Pending: 0,
      Offer: 0,
      Rejected: 0,
      Skipped: 0,
    };

    for (const row of rows) {
      const key = row.status;
      if (key in stats) {
        stats[key] = parseInt(row.count);
      }
      stats.total += parseInt(row.count);
    }

    return stats;
  },

  // Agent Runs
  async getAgentRuns(agentIds: string[]): Promise<AgentRun[]> {
    const { rows } = await pool.query(
      "SELECT * FROM agent_runs WHERE agent = ANY($1) ORDER BY completed_at DESC LIMIT 50",
      [agentIds]
    );
    return rows;
  },

  // Access Mappings
  async getAllMappings(): Promise<AccessMapping[]> {
    const { rows } = await pool.query("SELECT * FROM access_mappings ORDER BY email");
    return rows;
  },

  async getMappingByEmail(email: string): Promise<AccessMapping | null> {
    const { rows } = await pool.query("SELECT * FROM access_mappings WHERE email = $1", [email]);
    return rows[0] || null;
  },

  async upsertMapping(email: string, agentIds: string[]): Promise<AccessMapping> {
    const { rows } = await pool.query(
      "INSERT INTO access_mappings (email, agent_ids) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET agent_ids = $2 RETURNING *",
      [email, agentIds]
    );
    return rows[0];
  },

  async deleteMapping(email: string): Promise<boolean> {
    const { rowCount } = await pool.query("DELETE FROM access_mappings WHERE email = $1", [email]);
    return (rowCount ?? 0) > 0;
  },

  async replaceAllMappings(mappings: AccessMapping[]): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM access_mappings");
      for (const m of mappings) {
        await client.query(
          "INSERT INTO access_mappings (email, agent_ids) VALUES ($1, $2)",
          [m.email, m.agent_ids]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },

  async getAgentIdsForEmail(email: string): Promise<string[]> {
    const mapping = await this.getMappingByEmail(email);
    return mapping?.agent_ids || [];
  },
};
