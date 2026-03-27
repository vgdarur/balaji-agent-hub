import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { agents as allAgents, JOB_STATUSES } from "@shared/schema";
import type { HubJob } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Briefcase,
  Clock,
  Users,
  ExternalLink,
  LogOut,
  Shield,
  Play,
  Loader2,
  BarChart2,
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

const BOARDS = ["Dice", "LinkedIn", "Indeed", "CareerBuilder"] as const;

const BOARD_CONFIG: Record<string, { color: string; light: string; border: string; text: string }> = {
  Dice:          { color: "bg-orange-500", light: "bg-orange-50",  border: "border-orange-200", text: "text-orange-700" },
  LinkedIn:      { color: "bg-blue-600",   light: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-700" },
  Indeed:        { color: "bg-purple-600", light: "bg-purple-50",  border: "border-purple-200", text: "text-purple-700" },
  CareerBuilder: { color: "bg-green-600",  light: "bg-green-50",   border: "border-green-200",  text: "text-green-700" },
};

const STATUS_COLORS: Record<string, string> = {
  New:       "bg-blue-100 text-blue-700",
  Applied:   "bg-emerald-100 text-emerald-700",
  Interview: "bg-amber-100 text-amber-700",
  Offer:     "bg-purple-100 text-purple-700",
  Rejected:  "bg-red-100 text-red-700",
  Pending:   "bg-gray-100 text-gray-600",
  Skipped:   "bg-gray-100 text-gray-400",
};

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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);

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

  // Fetch ALL jobs (no source filter at API level — we filter client-side for accurate counts)
  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["/api/jobs", selectedAgent],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAgent !== "all") params.set("agent", selectedAgent);
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

  const allJobs = data?.jobs || [];
  const showAgentOnCard = selectedAgent === "all" && userAgents.length > 1;

  // Client-side filtering — single source of truth for counts and cards
  const visibleJobs = useMemo(() => {
    let result = allJobs;
    if (statusFilter !== "all") {
      result = result.filter((j) => j.status === statusFilter);
    }
    return result;
  }, [allJobs, statusFilter]);

  // Group by board (source), hide empty boards
  const boardGroups = useMemo(() => {
    return BOARDS.map((board) => ({
      board,
      jobs: visibleJobs.filter((j) => j.source === board),
    })).filter((g) => g.jobs.length > 0);
  }, [visibleJobs]);

  // Stats from the SAME visible array
  const stats = useMemo(() => ({
    total: visibleJobs.length,
    applied: visibleJobs.filter((j) => j.status === "Applied").length,
    interviews: visibleJobs.filter((j) => j.status === "Interview").length,
    offers: visibleJobs.filter((j) => j.status === "Offer").length,
  }), [visibleJobs]);

  const title =
    selectedAgent === "all"
      ? "All Candidates"
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
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Schedule banner */}
        {isAdmin && schedule?.enabled && schedule.nextRun && (
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-2 text-xs text-teal-700 flex items-center gap-2 flex-shrink-0">
            <Clock className="w-3.5 h-3.5" />
            Next agent run: <span className="font-semibold">{formatNextRun(schedule.nextRun)}</span>
          </div>
        )}

        {/* Header */}
        <header className="bg-white border-b border-gray-100 shadow-sm px-6 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-wrap">
              <h2 className="text-base font-bold text-gray-900" data-testid="text-dashboard-title">
                {title}
              </h2>
              {/* KPI pills — computed from the SAME visible array */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                  {stats.total} Total
                </span>
                <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full">
                  {stats.applied} Applied
                </span>
                {stats.interviews > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full">
                    {stats.interviews} Interviews
                  </span>
                )}
                {stats.offers > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full">
                    {stats.offers} Offers
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:ring-1 focus:ring-teal-400"
              >
                <option value="all">All Statuses</option>
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              {/* Run agents */}
              {isAdmin && (
                <button
                  onClick={handleRunNow}
                  disabled={running}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 disabled:opacity-50 transition-colors"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {running ? "Running..." : "Run Agents Now"}
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Kanban Board — columns = job boards */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">Loading jobs...</div>
          ) : boardGroups.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Briefcase className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No jobs found</p>
              <p className="text-xs mt-1">Try changing filters or run agents to fetch new jobs</p>
            </div>
          ) : (
            <div className="flex gap-4 p-4 h-full min-w-max">
              {boardGroups.map(({ board, jobs: boardJobs }) => {
                const config = BOARD_CONFIG[board];
                return (
                  <div
                    key={board}
                    className="flex flex-col w-72 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm"
                  >
                    {/* Column header */}
                    <div className={`${config.light} ${config.border} border-b px-4 py-3 flex items-center justify-between flex-shrink-0`}>
                      <span className={`text-sm font-bold uppercase tracking-wide ${config.text}`}>
                        {board}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full text-white ${config.color}`}>
                        {boardJobs.length}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
                      {boardJobs.map((job) => (
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

        <footer className="pb-3 pt-1 text-center flex-shrink-0">
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
  const statusStyle = STATUS_COLORS[job.status] || "bg-gray-100 text-gray-600";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all p-3 w-full">
      {/* Agent dot + name */}
      {showAgent && (
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${agentDot}`} />
          <span className="text-[10px] text-gray-400 truncate">{agentName}</span>
        </div>
      )}

      {/* Job title */}
      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-2 leading-tight">
        {job.title}
      </h3>

      {/* Company */}
      <p className="text-xs font-medium text-gray-600 mb-0.5">{job.company}</p>

      {/* Location */}
      <p className="text-[11px] text-gray-400 mb-3">{job.location}</p>

      {/* Status badge + Apply */}
      <div className="flex items-center justify-between gap-2">
        <select
          value={job.status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`text-[11px] font-semibold rounded-full px-2 py-0.5 border-0 focus:outline-none cursor-pointer appearance-none ${statusStyle}`}
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
          className="text-[11px] bg-teal-500 text-white px-2.5 py-1 rounded-lg hover:bg-teal-600 font-semibold whitespace-nowrap flex items-center gap-1"
          data-testid={`button-apply-${job.id}`}
        >
          Apply <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
