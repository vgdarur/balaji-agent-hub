import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { OAuth2Client } from "google-auth-library";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { initializeDatabase } from "./db";
import { adminEmails, recruiterEmails, agents } from "@shared/schema";

const GOOGLE_CLIENT_ID = "19615734221-469n6ahpnd9oocr1en0jo9s737l1f8eo.apps.googleusercontent.com";
const oauthClient = new OAuth2Client(GOOGLE_CLIENT_ID);

declare module "express-session" {
  interface SessionData {
    user?: {
      email: string;
      name: string;
      picture: string;
    };
  }
}

function requireAuth(req: Request, res: Response, next: () => void) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  if (!req.session.user || !adminEmails.includes(req.session.user.email)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

async function runAgentsInBackground() {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const TELEGRAM_BOT = "8603225576:AAHhD-C4_DZ8f__MXTV2cqyJN-AkxNrEyXo";
  const TELEGRAM_CHAT = "-1003828540142";

  const AGENTS = [
    { id: "krishnaja1", name: "V Krishna",   role: "Java Full Stack Developer",  location: "Dallas, TX" },
    { id: "udayja1",    name: "Uday Kumar",   role: "Front End Developer",        location: "Atlanta, GA" },
    { id: "shasheeja1", name: "Shashi Kumar", role: "DevOps Engineer",            location: "Remote" },
    { id: "rajja1",     name: "Raja Vamshi",  role: "Java Full Stack Developer",  location: "Remote" },
    { id: "dunteesja1", name: "Dunteesh",     role: "Python Developer",           location: "Remote" },
    { id: "purvaja1",   name: "Purva",        role: "Technical Writer",           location: "Remote" },
    { id: "ramanaja1",  name: "Ramana",       role: "React Developer",            location: "Remote" },
  ];

  // Search Dice for jobs without logging in (public search)
  const results: Record<string, { found: number; error?: string }> = {};

  for (const agent of AGENTS) {
    try {
      const search = encodeURIComponent(agent.role);
      const loc = encodeURIComponent(agent.location);
      const url = `https://www.dice.com/jobs?q=${search}&location=${loc}&filters.employmentType=CONTRACTS&page=1&pageSize=20`;
      
      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; JobBot/1.0)" }
      });
      const html = await resp.text();
      
      // Extract job data from page
      const jobMatches = html.match(/"jobId":"([^"]+)","title":"([^"]+)","companyPageUri":"([^"]+)","company":"([^"]+)"/g) || [];
      
      let inserted = 0;
      for (const match of jobMatches.slice(0, 15)) {
        const m = match.match(/"jobId":"([^"]+)","title":"([^"]+)","companyPageUri":"([^"]+)","company":"([^"]+)"/);
        if (!m) continue;
        const [, jobId, title, , company] = m;
        const jobUrl = `https://www.dice.com/job-detail/${jobId}`;
        
        try {
          await pool.query(`
            INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent)
            VALUES ($1, $2, $3, $4, 'Dice', 'New', $5)
            ON CONFLICT (job_url, agent) DO NOTHING
          `, [title, company, agent.location, jobUrl, agent.id]);
          inserted++;
        } catch {}
      }
      
      // Also update agent_runs
      await pool.query(`
        INSERT INTO agent_runs (agent, run_date, jobs_found, sources_searched, status, completed_at)
        VALUES ($1, CURRENT_DATE, $2, 'Dice', 'completed', NOW())
        ON CONFLICT (agent, run_date) DO UPDATE SET jobs_found=$2, status='completed', completed_at=NOW()
      `, [agent.id, inserted]);
      
      results[agent.id] = { found: inserted };
    } catch (err: any) {
      results[agent.id] = { found: 0, error: err.message };
    }
  }

  // Send Telegram summary
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const lines = [`📊 *Agent Run — ${today}*\n`];
  let total = 0;
  for (const agent of AGENTS) {
    const r = results[agent.id];
    const icon = r?.error ? "❌" : "✅";
    lines.push(`${icon} ${agent.id} (${agent.name}): ${r?.found || 0} new jobs found`);
    total += r?.found || 0;
  }
  lines.push(`\n📌 *Total: ${total} new jobs added*`);
  lines.push(`🔗 https://balaji-agent-hub-19615734221.us-east1.run.app`);

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: lines.join("\n"), parse_mode: "Markdown" }),
    });
  } catch {}

  await pool.end();
  return results;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize database tables and migrate data
  await initializeDatabase();

  // Session middleware
  const MemoryStore = createMemoryStore(session);
  app.use(
    session({
      secret: "balaji-agent-hub-secret-key-2026",
      resave: false,
      saveUninitialized: false,
      store: new MemoryStore({ checkPeriod: 86400000 }),
      cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        httpOnly: true,
        sameSite: "lax",
      },
    })
  );

  // ========== AUTH ROUTES ==========

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      const { credential } = req.body;
      if (!credential) {
        return res.status(400).json({ message: "Missing credential" });
      }

      const ticket = await oauthClient.verifyIdToken({
        idToken: credential,
        audience: GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Check if user has access
      const agentIds = await storage.getAgentIdsForEmail(payload.email);
      if (agentIds.length === 0) {
        return res.status(403).json({ message: "Access denied. Your email is not authorized." });
      }

      req.session.user = {
        email: payload.email,
        name: payload.name || payload.email,
        picture: payload.picture || "",
      };

      res.json({
        user: req.session.user,
        isAdmin: adminEmails.includes(payload.email),
        agents: agents.filter((a) => agentIds.includes(a.id)),
      });
    } catch (err) {
      console.error("Google auth error:", err);
      res.status(401).json({ message: "Authentication failed" });
    }
  });

  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const email = req.session.user.email;
    const agentIds = await storage.getAgentIdsForEmail(email);

    if (agentIds.length === 0) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Access revoked" });
    }

    res.json({
      user: req.session.user,
      isAdmin: adminEmails.includes(email),
      agents: agents.filter((a) => agentIds.includes(a.id)),
    });
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy(() => {});
    res.json({ message: "Logged out" });
  });

  // ========== JOBS ROUTES ==========

  app.get("/api/jobs", requireAuth, async (req: Request, res: Response) => {
    const email = req.session.user!.email;
    const agentIds = await storage.getAgentIdsForEmail(email);

    const agentFilter = req.query.agent as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const sourceFilter = req.query.source as string | undefined;

    // Validate agent filter is in user's allowed agents
    if (agentFilter && !agentIds.includes(agentFilter)) {
      return res.status(403).json({ message: "Not authorized for this agent" });
    }

    const jobs = await storage.getJobs(agentIds, agentFilter, statusFilter, sourceFilter);
    const stats = await storage.getJobStats(agentIds, agentFilter);

    res.json({ jobs, stats });
  });

  app.patch("/api/jobs/:id/status", requireAuth, async (req: Request, res: Response) => {
    const email = req.session.user!.email;
    const jobId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Missing status" });
    }

    // Admins and recruiters can update any job — candidates only their own
    const isRecruiterOrAdmin = adminEmails.includes(email) || recruiterEmails.includes(email);
    let agentIds: string[];
    if (isRecruiterOrAdmin) {
      agentIds = agents.map(a => a.id); // all agents
    } else {
      agentIds = await storage.getAgentIdsForEmail(email);
    }

    const updated = await storage.updateJobStatus(jobId, status, agentIds);
    if (!updated) {
      return res.status(404).json({ message: "Job not found or not authorized" });
    }

    res.json(updated);
  });

  // ========== AGENT RUNS ROUTES ==========

  app.get("/api/agents/runs", requireAuth, async (req: Request, res: Response) => {
    const email = req.session.user!.email;
    const agentIds = await storage.getAgentIdsForEmail(email);
    const runs = await storage.getAgentRuns(agentIds);
    res.json(runs);
  });

  // ========== ADMIN ROUTES ==========

  app.get("/api/admin/mappings", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    const mappings = await storage.getAllMappings();
    res.json({ mappings, agents });
  });

  app.put("/api/admin/mappings", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ message: "Invalid mappings format" });
    }
    await storage.replaceAllMappings(mappings);
    res.json({ message: "Mappings updated" });
  });

  app.post("/api/admin/mappings", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const { email, agent_ids } = req.body;
    if (!email || !Array.isArray(agent_ids)) {
      return res.status(400).json({ message: "Invalid data" });
    }
    const mapping = await storage.upsertMapping(email, agent_ids);
    res.json(mapping);
  });

  app.delete("/api/admin/mappings/:email", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const email = decodeURIComponent(req.params.email);
    const deleted = await storage.deleteMapping(email);
    if (!deleted) {
      return res.status(404).json({ message: "Mapping not found" });
    }
    res.json({ message: "Mapping deleted" });
  });

  // ========== AGENT RUNNER ROUTES ==========

  // In-memory run status tracker
  const runStatus: {
    running: boolean;
    startedAt: string | null;
    lastRun: string | null;
    lastResults: any | null;
  } = { running: false, startedAt: null, lastRun: null, lastResults: null };

  // GET /api/agents/run-status — get current run status
  app.get("/api/agents/run-status", requireAuth, (_req: Request, res: Response) => {
    res.json(runStatus);
  });

  // POST /api/agents/run-now — admin only OR valid API key
  app.post("/api/agents/run-now", async (req: Request, res: Response) => {
    const apiKey = req.headers["x-api-key"] || req.query.key;
    const validKey = process.env.AGENT_API_KEY || "balaji-run-2026-venu";
    const isAuthorized = apiKey === validKey ||
      (req.session?.user && adminEmails.includes(req.session.user.email));
    if (!isAuthorized) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (runStatus.running) {
      return res.status(409).json({ message: "Agents are already running. Please wait." });
    }

    runStatus.running = true;
    runStatus.startedAt = new Date().toISOString();
    res.json({ message: "Agent run started", startedAt: runStatus.startedAt });

    // Run agents in background (non-blocking)
    runAgentsInBackground().then((results) => {
      runStatus.running = false;
      runStatus.lastRun = new Date().toISOString();
      runStatus.lastResults = results;
    }).catch((err) => {
      runStatus.running = false;
      runStatus.lastRun = new Date().toISOString();
      runStatus.lastResults = { error: err.message };
    });
  });

  // Admin-only reports endpoint
  app.get("/api/admin/reports", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    const pool = new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      // Daily agent runs (last 7 days)
      const runsResult = await pool.query(`
        SELECT agent, run_date, jobs_found, sources_searched, status, completed_at
        FROM agent_runs
        ORDER BY run_date DESC, completed_at DESC
        LIMIT 100
      `);

      // Total applications per agent
      const totalsResult = await pool.query(`
        SELECT agent, status, COUNT(*) as count
        FROM hub_jobs
        GROUP BY agent, status
        ORDER BY agent, status
      `);

      // Job status breakdown per agent
      const statusResult = await pool.query(`
        SELECT agent,
          COUNT(*) FILTER (WHERE status = 'New') as new_count,
          COUNT(*) FILTER (WHERE status = 'Applied') as applied_count,
          COUNT(*) FILTER (WHERE status = 'Interview') as interview_count,
          COUNT(*) FILTER (WHERE status = 'Offer') as offer_count,
          COUNT(*) FILTER (WHERE status = 'Rejected') as rejected_count,
          COUNT(*) as total_count
        FROM hub_jobs
        GROUP BY agent
        ORDER BY agent
      `);

      // Failed runs
      const failedResult = await pool.query(`
        SELECT agent, run_date, status, completed_at
        FROM agent_runs
        WHERE status = 'failed'
        ORDER BY run_date DESC
        LIMIT 20
      `);

      await pool.end();

      res.json({
        dailyRuns: runsResult.rows,
        totals: totalsResult.rows,
        statusBreakdown: statusResult.rows,
        failedRuns: failedResult.rows,
      });
    } catch (err: any) {
      await pool.end();
      res.status(500).json({ message: err.message });
    }
  });

  return httpServer;
}
