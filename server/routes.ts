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
    { id: "venuja1",    name: "Venu Gopal",   searches: ["Software Engineering Manager", "Senior Engineering Manager"] },
    { id: "krishnaja1", name: "V Krishna",    searches: ["Java Full Stack Developer", "Java Developer"] },
    { id: "udayja1",    name: "Uday Kumar",   searches: ["Front End Developer", "React Developer", "Angular Developer"] },
    { id: "shasheeja1", name: "Shashi Kumar", searches: ["DevOps Engineer", "Cloud Engineer", "SRE Engineer"] },
    { id: "rajja1",     name: "Raja Vamshi",  searches: ["Java Developer", "Software Engineer", "Full Stack Developer", "Python Developer"] },
    { id: "dunteesja1", name: "Dunteesh",     searches: ["Python Developer", "Python Engineer"] },
    { id: "purvaja1",   name: "Purva",        searches: ["Technical Writer", "Documentation Specialist"] },
    { id: "ramanaja1",  name: "Ramana",       searches: ["React Developer", "React Engineer", "Frontend Developer"] },
  ];

  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const results: Record<string, { dice: number; linkedin: number; indeed: number; careerbuilder: number; ziprecruiter: number; monster: number; total: number }> = {};

  for (const agent of AGENTS) {
    results[agent.id] = { dice: 0, linkedin: 0, indeed: 0, careerbuilder: 0, ziprecruiter: 0, monster: 0, total: 0 };

    for (const searchTerm of agent.searches) {
      const encoded = encodeURIComponent(searchTerm);

      // 1. DICE — public search
      try {
        const diceUrl = `https://www.dice.com/jobs?q=${encoded}&filters.employmentType=CONTRACTS&filters.workplaceTypes=Remote&page=1&pageSize=20`;
        const resp = await fetch(diceUrl, { headers: { "User-Agent": UA } });
        const html = await resp.text();
        const idMatches = html.match(/job-detail\/([a-f0-9-]{36})/g) || [];
        const titleMatches = html.match(/"jobTitle"\s*:\s*"([^"]+)"/g) || [];
        const companyMatches = html.match(/"companyName"\s*:\s*"([^"]+)"/g) || [];
        const uniqueIds = [...new Set(idMatches.map((m: string) => m.replace("job-detail/", "")))].slice(0, 10);
        for (let i = 0; i < uniqueIds.length; i++) {
          const jobUrl = `https://www.dice.com/job-detail/${uniqueIds[i]}`;
          const title = titleMatches[i] ? titleMatches[i].replace(/"jobTitle"\s*:\s*"/, "").replace(/"$/, "") : searchTerm;
          const company = companyMatches[i] ? companyMatches[i].replace(/"companyName"\s*:\s*"/, "").replace(/"$/, "") : "Via Dice";
          try {
            const res = await pool.query(
              `INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent) VALUES ($1, $2, 'Remote', $3, 'Dice', 'New', $4) ON CONFLICT (job_url, agent) DO NOTHING`,
              [title, company, jobUrl, agent.id]
            );
            if (res.rowCount && res.rowCount > 0) results[agent.id].dice++;
          } catch {}
        }
      } catch {}

      // 2. LINKEDIN — public guest job search API
      try {
        const liUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encoded}&f_JT=C&f_WT=2&start=0`;
        const resp = await fetch(liUrl, { headers: { "User-Agent": UA } });
        const html = await resp.text();
        const jobIds = html.match(/data-entity-urn="urn:li:jobPosting:(\d+)"/g) || [];
        const titles = html.match(/<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([^<]+)<\/h3>/g) || [];
        const companies = html.match(/<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([^<]+)<\/h4>/g) || [];
        for (let i = 0; i < Math.min(jobIds.length, 5); i++) {
          const id = jobIds[i].replace(/.*:(\d+)"/, "$1");
          const jobUrl = `https://www.linkedin.com/jobs/view/${id}`;
          const title = titles[i] ? titles[i].replace(/<[^>]+>/g, "").trim() : searchTerm;
          const company = companies[i] ? companies[i].replace(/<[^>]+>/g, "").trim() : "Via LinkedIn";
          try {
            const res = await pool.query(
              `INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent) VALUES ($1, $2, 'Remote', $3, 'LinkedIn', 'New', $4) ON CONFLICT (job_url, agent) DO NOTHING`,
              [title, company, jobUrl, agent.id]
            );
            if (res.rowCount && res.rowCount > 0) results[agent.id].linkedin++;
          } catch {}
        }
      } catch {}

      // 3. ZIPRECRUITER — public search
      try {
        const zipUrl = `https://api.ziprecruiter.com/jobs/search?search=${encoded}&location=Remote&radius_miles=25&days_ago=3&jobs_per_page=10&page=1`;
        const resp = await fetch(zipUrl, { headers: { "User-Agent": UA } });
        if (resp.ok) {
          const data = await resp.json() as any;
          const jobs = data.jobs || [];
          for (const job of jobs.slice(0, 5)) {
            try {
              const res = await pool.query(
                `INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent) VALUES ($1, $2, $3, $4, 'ZipRecruiter', 'New', $5) ON CONFLICT (job_url, agent) DO NOTHING`,
                [job.name || searchTerm, job.hiring_company?.name || "Via ZipRecruiter", job.location || "Remote", job.url || "https://www.ziprecruiter.com", agent.id]
              );
              if (res.rowCount && res.rowCount > 0) results[agent.id].ziprecruiter++;
            } catch {}
          }
        }
      } catch {}

      // 4. CAREERBUILDER — public search
      try {
        const cbUrl = `https://www.careerbuilder.com/jobs?keywords=${encoded}&location=Remote&emp=jtc2`;
        const resp = await fetch(cbUrl, { headers: { "User-Agent": UA } });
        const html = await resp.text();
        const cbPaths = html.match(/\/job-details\/[a-zA-Z0-9_-]+/g) || [];
        const cbTitles = html.match(/class="[^"]*job-title[^"]*"[^>]*>([^<]+)</g) || [];
        const uniqueCb = [...new Set(cbPaths)].slice(0, 5);
        for (let i = 0; i < uniqueCb.length; i++) {
          const jobUrl = `https://www.careerbuilder.com${uniqueCb[i]}`;
          const title = cbTitles[i] ? cbTitles[i].replace(/class="[^"]*"[^>]*>/, "").replace("<", "").trim() : searchTerm;
          try {
            const res = await pool.query(
              `INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent) VALUES ($1, 'Via CareerBuilder', 'Remote', $2, 'CareerBuilder', 'New', $3) ON CONFLICT (job_url, agent) DO NOTHING`,
              [title, jobUrl, agent.id]
            );
            if (res.rowCount && res.rowCount > 0) results[agent.id].careerbuilder++;
          } catch {}
        }
      } catch {}

      // 5. MONSTER — public search
      try {
        const monsterUrl = `https://www.monster.com/jobs/search?q=${encoded}&where=Remote&tm=3&jt=contract`;
        const resp = await fetch(monsterUrl, { headers: { "User-Agent": UA } });
        const html = await resp.text();
        const monsterPaths = html.match(/\/job-openings\/[^"?]+/g) || [];
        const uniqueMonster = [...new Set(monsterPaths)].slice(0, 5);
        for (const path of uniqueMonster) {
          try {
            const res = await pool.query(
              `INSERT INTO hub_jobs (title, company, location, job_url, source, status, agent) VALUES ($1, 'Via Monster', 'Remote', $2, 'Monster', 'New', $3) ON CONFLICT (job_url, agent) DO NOTHING`,
              [searchTerm, `https://www.monster.com${path}`, agent.id]
            );
            if (res.rowCount && res.rowCount > 0) results[agent.id].monster++;
          } catch {}
        }
      } catch {}
    }

    results[agent.id].total = results[agent.id].dice + results[agent.id].linkedin +
      results[agent.id].indeed + results[agent.id].careerbuilder +
      results[agent.id].ziprecruiter + results[agent.id].monster;

    // Update agent_runs
    try {
      await pool.query(
        `INSERT INTO agent_runs (agent, run_date, jobs_found, sources_searched, status, completed_at)
         VALUES ($1, CURRENT_DATE, $2, 'Dice,LinkedIn,CareerBuilder,ZipRecruiter,Monster', 'completed', NOW())
         ON CONFLICT (agent, run_date) DO UPDATE SET jobs_found=$2, status='completed', completed_at=NOW()`,
        [agent.id, results[agent.id].total]
      );
    } catch {}
  }

  // Telegram report
  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const lines = [`Daily Multi-Board Report - ${today}\n`];
  let grandTotal = 0;
  for (const agent of AGENTS) {
    const r = results[agent.id];
    lines.push(`${agent.name}: ${r.total} new (Dice:${r.dice} LI:${r.linkedin} CB:${r.careerbuilder} ZIP:${r.ziprecruiter} MON:${r.monster})`);
    grandTotal += r.total;
  }
  lines.push(`\nTotal new jobs: ${grandTotal}`);
  lines.push(`Dashboard: https://balaji-agent-hub-19615734221.us-east1.run.app`);

  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text: lines.join("\n") }),
    });
  } catch {}

  await pool.end();
  return results;
}

const scheduleConfig = {
  enabled: true,
  time: "06:00", // 6 AM ET
  nextRun: "",
  lastRun: "",
};

// In-memory run status for the auto-scheduler (shared with route handler below)
let autoSchedulerRunStatus: {
  running: boolean;
  startedAt: string | null;
  lastRun: string | null;
  lastResults: any | null;
} | null = null;

// Auto-scheduler — checks every minute if it's time to run
setInterval(async () => {
  if (!scheduleConfig.enabled) return;
  // We'll get the runStatus reference from the route handler
  if (autoSchedulerRunStatus && autoSchedulerRunStatus.running) return;

  const now = new Date();
  const etTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const [schedHour, schedMin] = scheduleConfig.time.split(":").map(Number);

  if (etTime.getHours() === schedHour && etTime.getMinutes() === schedMin) {
    console.log("Auto-scheduler: triggering agent run...");
    scheduleConfig.lastRun = new Date().toISOString();
    if (autoSchedulerRunStatus) {
      autoSchedulerRunStatus.running = true;
      autoSchedulerRunStatus.startedAt = new Date().toISOString();
    }
    runAgentsInBackground()
      .then((results) => {
        if (autoSchedulerRunStatus) {
          autoSchedulerRunStatus.running = false;
          autoSchedulerRunStatus.lastRun = new Date().toISOString();
          autoSchedulerRunStatus.lastResults = results;
        }
      })
      .catch(() => {
        if (autoSchedulerRunStatus) {
          autoSchedulerRunStatus.running = false;
        }
      });
  }
}, 60000); // check every minute

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

  // Wire up auto-scheduler to share the same runStatus
  autoSchedulerRunStatus = runStatus;

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

  // ========== AGENT CONFIG ROUTES ==========

  // GET /api/admin/agents — list all agent configs
  app.get("/api/admin/agents", requireAuth, requireAdmin, async (_req: Request, res: Response) => {
    const pool = new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS agent_config (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          location TEXT NOT NULL,
          dice_email TEXT,
          dice_password TEXT,
          color TEXT DEFAULT 'hsl(200, 80%, 50%)',
          search_term TEXT,
          active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
      // Seed from default agents if table is empty
      const existing = await pool.query("SELECT COUNT(*) FROM agent_config");
      if (parseInt(existing.rows[0].count) === 0) {
        const defaultAgents = [
          { id: "krishnaja1", name: "V Krishna", role: "C2C Java Fullstack", location: "Dallas/Remote", color: "hsl(262, 72%, 56%)", search_term: "Java Full Stack Developer" },
          { id: "udayja1", name: "Uday Kumar", role: "C2C Front-End Dev", location: "Atlanta/Remote", color: "hsl(38, 92%, 50%)", search_term: "Front End Developer" },
          { id: "shasheeja1", name: "Shashi Kumar", role: "C2C DevOps/SRE", location: "Remote", color: "hsl(340, 75%, 55%)", search_term: "DevOps Engineer" },
          { id: "rajja1", name: "Raja Vamshi", role: "C2C Java Fullstack", location: "Remote", color: "hsl(200, 80%, 50%)", search_term: "Java Full Stack Developer" },
          { id: "dunteesja1", name: "Dunteesh", role: "C2C Python Dev", location: "Remote", color: "hsl(25, 90%, 55%)", search_term: "Python Developer" },
          { id: "purvaja1", name: "Purva", role: "C2C Technical Writer", location: "Remote", color: "hsl(290, 70%, 55%)", search_term: "Technical Writer" },
          { id: "ramanaja1", name: "Ramana", role: "C2C React Dev", location: "Remote", color: "hsl(150, 70%, 45%)", search_term: "React Developer" },
        ];
        for (const a of defaultAgents) {
          await pool.query(
            "INSERT INTO agent_config (id, name, role, location, color, search_term) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
            [a.id, a.name, a.role, a.location, a.color, a.search_term]
          );
        }
      }
      const result = await pool.query(
        "SELECT id, name, role, location, dice_email, color, search_term, active FROM agent_config ORDER BY created_at"
      );
      await pool.end();
      res.json(result.rows);
    } catch (err: any) {
      await pool.end();
      res.status(500).json({ message: err.message });
    }
  });

  // POST /api/admin/agents — add new agent
  app.post("/api/admin/agents", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const pool = new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    const { id, name, role, location, dice_email, dice_password, color, search_term } = req.body;
    try {
      await pool.query(
        "INSERT INTO agent_config (id, name, role, location, dice_email, dice_password, color, search_term) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
        [id, name, role, location, dice_email || null, dice_password || null, color || "hsl(200, 80%, 50%)", search_term || null]
      );
      await pool.end();
      res.json({ message: "Agent added" });
    } catch (err: any) {
      await pool.end();
      res.status(500).json({ message: err.message });
    }
  });

  // PUT /api/admin/agents/:id — update agent
  app.put("/api/admin/agents/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const pool = new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    const { name, role, location, dice_email, dice_password, color, search_term } = req.body;
    try {
      if (dice_password) {
        await pool.query(
          "UPDATE agent_config SET name=$1, role=$2, location=$3, dice_email=$4, dice_password=$5, color=$6, search_term=$7 WHERE id=$8",
          [name, role, location, dice_email || null, dice_password, color, search_term || null, req.params.id]
        );
      } else {
        await pool.query(
          "UPDATE agent_config SET name=$1, role=$2, location=$3, dice_email=$4, color=$5, search_term=$6 WHERE id=$7",
          [name, role, location, dice_email || null, color, search_term || null, req.params.id]
        );
      }
      await pool.end();
      res.json({ message: "Agent updated" });
    } catch (err: any) {
      await pool.end();
      res.status(500).json({ message: err.message });
    }
  });

  // DELETE /api/admin/agents/:id — remove agent
  app.delete("/api/admin/agents/:id", requireAuth, requireAdmin, async (req: Request, res: Response) => {
    const pool = new (require("pg").Pool)({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await pool.query("DELETE FROM agent_config WHERE id = $1", [req.params.id]);
      await pool.end();
      res.json({ message: "Agent removed" });
    } catch (err: any) {
      await pool.end();
      res.status(500).json({ message: err.message });
    }
  });

  // ========== SCHEDULER ROUTES ==========

  // Get scheduler config
  app.get("/api/admin/schedule", requireAuth, requireAdmin, (_req: Request, res: Response) => {
    res.json({
      enabled: scheduleConfig.enabled,
      time: scheduleConfig.time,
      nextRun: scheduleConfig.nextRun,
      lastRun: scheduleConfig.lastRun,
    });
  });

  // Update scheduler config
  app.post("/api/admin/schedule", requireAuth, requireAdmin, (req: Request, res: Response) => {
    const { enabled, time } = req.body;
    scheduleConfig.enabled = enabled ?? scheduleConfig.enabled;
    scheduleConfig.time = time ?? scheduleConfig.time;

    // Calculate next run
    const [hours, minutes] = scheduleConfig.time.split(":").map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next <= new Date()) next.setDate(next.getDate() + 1);
    scheduleConfig.nextRun = next.toISOString();

    res.json(scheduleConfig);
  });

  return httpServer;
}
