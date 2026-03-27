import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { agents as allAgents, JOB_STATUSES } from "@shared/schema";
import type { HubJob } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Briefcase,
  CheckCircle,
  Clock,
  Users,
  Award,
  ExternalLink,
  LogOut,
  Shield,
  Play,
  Loader2,
  BarChart2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useLocation } from "wouter";

interface JobsResponse {
  jobs: HubJob[];
  stats: Record<string, number>;
}

interface ScheduleConfig {
  enabled: boolean;
  time: string;
  nextRun: string;
  lastRun: string;
}

const COLUMN_CONFIG: Record<string, { bg: string; light: string; border: string; text: string; dot: string }> = {
  New:       { bg: "bg-blue-500",    light: "bg-blue-50",    border: "border-blue-200",    text: "text-blue-700",    dot: "bg-blue-500" },
  Applied:   { bg: "bg-emerald-500", light: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  Interview: { bg: "bg-amber-500",   light: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-700",   dot: "bg-amber-500" },
  Offer:     { bg: "bg-purple-500",  light: "bg-purple-50",  border: "border-purple-200",  text: "text-purple-700",  dot: "bg-purple-500" },
  Rejected:  { bg: "bg-red-500",     light: "bg-red-50",     border: "border-red-200",     text: "text-red-700",     dot: "bg-red-500" },
};

const KANBAN_STATUSES = ["New", "Applied", "Interview", "Offer", "Rejected"];

const AGENT_DOT_COLORS: Record<string, string> = {
  venuja1: "bg-teal-500",
  krishnaja1: "bg-purple-500",
  udayja1: "bg-amber-500",
  shasheeja1: "bg-pink-500",
  rajja1: "bg-blue-500",
  dunteesja1: "bg-orange-500",
  purvaja1: "bg-violet-500",
  ramanaja1: "bg-green-500",
};

const SOURCE_STYLES: Record<string, string> = {
  Dice: "bg-orange-100 text-orange-700",
  LinkedIn: "bg-blue-100 text-blue-700",
  Indeed: "bg-purple-100 text-purple-700",
  CareerBuilder: "bg-green-100 text-green-700",
};

function formatNextRun(d: string) {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (date.toDateString() === now.toDateString()) return `Today ${time} ET`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time} ET`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ` ${time} ET`;
}

export default function DashboardPage({ onReports }: { onReports?: () => void } = {}) {
  const { user, isAdmin, agents: userAgents, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [showAllColumns, setShowAllColumns] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/schedule")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSchedule(d))
      .catch(() => {});
  }, [isAdmin]);

  const handleRunNow = async () => {
    if (running) return;
    setRunning(true);
    try {
      await apiRequest("POST", "/api/agents/run-now");
    } catch (err) {
      console.error("Run agents failed:", err);
    }
    setTimeout(() => {
      setRunning(false);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    }, 30000);
  };

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["/api/jobs", selectedAgent, "all", sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAgent !== "all") params.set("agent", selectedAgent);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      const res = await apiRequest("GET", `/api/jobs?${params.toString()}`);
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/jobs/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    },
  });

  const jobs = data?.jobs || [];
  const stats = data?.stats || { total: 0, Applied: 0, Interview: 0, Pending: 0, Offer: 0, New: 0 };
  const showAgentOnCard = selectedAgent === "all" && userAgents.length > 1;

  // Group jobs by status
  const jobsByStatus: Record<string, HubJob[]> = {};
  for (const s of KANBAN_STATUSES) {
    jobsByStatus[s] = [];
  }
  for (const job of jobs) {
    const normalized = job.status.charAt(0).toUpperCase() + job.status.slice(1).toLowerCase();
    if (jobsByStatus[normalized]) {
      jobsByStatus[normalized].push(job);
    }
  }

  // Filter columns: only show non-empty unless showAllColumns is on
  const visibleColumns = showAllColumns
    ? KANBAN_STATUSES
    : KANBAN_STATUSES.filter((s) => (jobsByStatus[s]?.length || 0) > 0);

  const title =
    selectedAgent === "all"
      ? "All Jobs"
      : `${allAgents.find((a) => a.id === selectedAgent)?.name || ""}'s Jobs`;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-100 shadow-sm flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
              <rect x="2" y="2" width="40" height="40" rx="10" stroke="hsl(174, 72%, 46%)" strokeWidth="2.5" fill="none" />
              <circle cx="22" cy="16" r="5" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" />
              <path d="M12 34c0-6 4-10 10-10s10 4 10 10" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-bold text-gray-900">Balaji Agent Hub</span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-3">
          <p className="text-xs font-medium text-gray-400 mb-2 px-2 uppercase tracking-wider">Agents</p>

          {isAdmin && (
            <button
              onClick={() => setSelectedAgent("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedAgent === "all"
                  ? "bg-orange-50 text-orange-700 font-medium border border-orange-200"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              data-testid="button-all-agents"
            >
              <Users className="w-4 h-4 inline mr-2" />
              All Agents
            </button>
          )}

          {userAgents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedAgent === agent.id
                  ? "bg-orange-50 text-orange-700 font-medium border border-orange-200"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
              data-testid={`button-agent-${agent.id}`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle ${AGENT_DOT_COLORS[agent.id] || "bg-gray-400"}`} />
              {agent.name}
              <span className="block text-xs text-gray-400 pl-5 mt-0.5">{agent.role}</span>
            </button>
          ))}
        </ScrollArea>

        {isAdmin && (
          <div className="p-3 border-t border-gray-100 space-y-1.5">
            <button
              onClick={() => setLocation("/admin")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2 font-medium"
              data-testid="button-admin-panel"
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
            {onReports && (
              <button
                onClick={onReports}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-600 text-xs font-semibold hover:bg-blue-100 transition-colors border border-blue-200"
              >
                <BarChart2 className="w-3.5 h-3.5 shrink-0" />
                Reports
              </button>
            )}
          </div>
        )}

        <div className="p-3 border-t border-gray-100">
          <div className="flex items-center gap-2 px-2">
            {user?.picture && (
              <img src={user.picture} className="w-7 h-7 rounded-full" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-300 hover:text-gray-600 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Schedule banner */}
        {isAdmin && schedule?.enabled && schedule.nextRun && (
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-2 text-xs text-teal-700 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Next agent run: <span className="font-semibold">{formatNextRun(schedule.nextRun)}</span>
          </div>
        )}

        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-100 px-6 py-4">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900" data-testid="text-dashboard-title">
                {title}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                {selectedAgent === "all"
                  ? "Overview of all agent job tracking"
                  : allAgents.find((a) => a.id === selectedAgent)?.role || ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Source filter */}
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                data-testid="select-source-filter"
              >
                <option value="all">All Sources</option>
                <option value="Dice">Dice</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Indeed">Indeed</option>
                <option value="CareerBuilder">CareerBuilder</option>
              </select>

              {/* Show all columns toggle */}
              {isAdmin && (
                <button
                  onClick={() => setShowAllColumns(!showAllColumns)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    showAllColumns
                      ? "bg-gray-100 border-gray-300 text-gray-700"
                      : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                  title={showAllColumns ? "Hide empty columns" : "Show all columns"}
                >
                  {showAllColumns ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showAllColumns ? "Hide Empty" : "Show All"}
                </button>
              )}

              {isAdmin && (
                <button
                  onClick={handleRunNow}
                  disabled={running}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {running ? "Running..." : "Run Agents Now"}
                </button>
              )}
            </div>
          </div>

          {/* KPI pills */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1">
              <Briefcase className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500">Total</span>
              <span className="text-sm font-bold text-gray-900">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-emerald-50 rounded-full px-3 py-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-xs text-emerald-600">Applied</span>
              <span className="text-sm font-bold text-emerald-700">{stats.Applied || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-amber-50 rounded-full px-3 py-1">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-xs text-amber-600">Interviews</span>
              <span className="text-sm font-bold text-amber-700">{stats.Interview || 0}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-purple-50 rounded-full px-3 py-1">
              <Award className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-xs text-purple-600">Offers</span>
              <span className="text-sm font-bold text-purple-700">{stats.Offer || 0}</span>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">Loading jobs...</div>
          ) : visibleColumns.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No jobs found</p>
              <p className="text-xs mt-1">Try changing filters or run agents to fetch new jobs</p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
              {visibleColumns.map((status) => {
                const colJobs = jobsByStatus[status] || [];
                const config = COLUMN_CONFIG[status];
                return (
                  <div
                    key={status}
                    className="min-w-[280px] max-w-[320px] flex flex-col flex-1"
                  >
                    {/* Column header */}
                    <div className={`${config.light} border ${config.border} rounded-t-xl px-4 py-3 flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                        <span className={`text-sm font-bold uppercase tracking-wide ${config.text}`}>
                          {status}
                        </span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.bg} text-white`}>
                        {colJobs.length}
                      </span>
                    </div>

                    {/* Column body */}
                    <div
                      className={`flex-1 bg-gray-50 border-x border-b ${config.border} rounded-b-xl p-2.5 space-y-2.5 overflow-y-auto`}
                      style={{ maxHeight: "calc(100vh - 320px)" }}
                    >
                      {colJobs.map((job) => (
                        <JobCard
                          key={job.id}
                          job={job}
                          showAgent={showAgentOnCard}
                          onStatusChange={(newStatus) =>
                            statusMutation.mutate({ id: job.id, status: newStatus })
                          }
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="pb-4 text-center">
          <a
            href="https://www.perplexity.ai/computer"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Balaji Agent Hub · Powered by Perplexity Computer
          </a>
        </footer>
      </main>
    </div>
  );
}

function JobCard({
  job,
  showAgent,
  onStatusChange,
}: {
  job: HubJob;
  showAgent: boolean;
  onStatusChange: (status: string) => void;
}) {
  const agentDot = AGENT_DOT_COLORS[job.agent] || "bg-gray-400";
  const agentName = allAgents.find((a) => a.id === job.agent)?.name || job.agent;
  const sourceBadge = SOURCE_STYLES[job.source] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer group">
      {/* Top row: source badge + agent dot */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sourceBadge}`}>
          {job.source}
        </span>
        {showAgent && (
          <div className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-full ${agentDot}`} />
            <span className="text-[10px] text-gray-400">{agentName}</span>
          </div>
        )}
      </div>

      {/* Job title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 group-hover:text-teal-600 transition-colors">
        {job.title}
      </h3>

      {/* Company */}
      <p className="text-xs text-gray-600 font-medium mb-0.5">{job.company}</p>

      {/* Location */}
      <p className="text-xs text-gray-400 mb-3">{job.location}</p>

      {/* Bottom: status dropdown + Apply button */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400 flex-1 min-w-0"
          data-testid={`select-status-${job.id}`}
        >
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <a
          href={job.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-teal-500 text-white px-3 py-1 rounded-lg hover:bg-teal-600 transition-colors font-medium flex items-center gap-1 whitespace-nowrap shadow-sm"
          data-testid={`button-apply-${job.id}`}
        >
          Apply <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
