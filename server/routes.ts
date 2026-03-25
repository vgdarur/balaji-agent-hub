import type { Express, Request, Response } from "express";
import { type Server } from "http";
import { OAuth2Client } from "google-auth-library";
import session from "express-session";
import createMemoryStore from "memorystore";
import { storage } from "./storage";
import { initializeDatabase } from "./db";
import { adminEmails, agents } from "@shared/schema";

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
    const agentIds = await storage.getAgentIdsForEmail(email);
    const jobId = parseInt(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Missing status" });
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

  return httpServer;
}
