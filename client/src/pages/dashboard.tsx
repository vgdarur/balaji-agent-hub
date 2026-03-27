import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { agents as allAgents, JOB_STATUSES } from "@shared/schema";
import type { HubJob } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const KANBAN_COLUMNS = [
  { status: "New", label: "NEW", headerBg: "bg-blue-50", headerBorder: "border-blue-200", headerText: "text-blue-700", dotBg: "bg-blue-500" },
  { status: "Applied", label: "APPLIED", headerBg: "bg-green-50", headerBorder: "border-green-200", headerText: "text-green-700", dotBg: "bg-green-500" },
  { status: "Interview", label: "INTERVIEW", headerBg: "bg-amber-50", headerBorder: "border-amber-200", headerText: "text-amber-700", dotBg: "bg-amber-500" },
  { status: "Offer", label: "OFFER", headerBg: "bg-purple-50", headerBorder: "border-purple-200", headerText: "text-purple-700", dotBg: "bg-purple-500" },
  { status: "Rejected", label: "REJECTED", headerBg: "bg-red-50", headerBorder: "border-red-200", headerText: "text-red-700", dotBg: "bg-red-500" },
] as const;

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
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);

  // Fetch schedule for admin banner
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

  // Group jobs by status for kanban
  const jobsByStatus: Record<string, HubJob[]> = {};
  for (const col of KANBAN_COLUMNS) {
    jobsByStatus[col.status] = [];
  }
  for (const job of jobs) {
    const normalized = job.status.charAt(0).toUpperCase() + job.status.slice(1).toLowerCase();
    if (jobsByStatus[normalized]) {
      jobsByStatus[normalized].push(job);
    }
  }

  const title =
    selectedAgent === "all"
      ? "All Jobs"
      : `${allAgents.find((a) => a.id === selectedAgent)?.name || ""}'s Jobs`;

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar — light gray */}
      <aside className="w-64 bg-gray-100 border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-gray-200">
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
          <p className="text-xs font-medium text-gray-500 mb-2 px-2">AGENTS</p>

          {isAdmin && (
            <button
              onClick={() => setSelectedAgent("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedAgent === "all"
                  ? "bg-orange-50 text-orange-700 font-medium border border-orange-200"
                  : "text-gray-700 hover:bg-gray-200"
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
                  : "text-gray-700 hover:bg-gray-200"
              }`}
              data-testid={`button-agent-${agent.id}`}
            >
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${AGENT_DOT_COLORS[agent.id] || "bg-gray-400"}`}
              />
              {agent.name}
              <span className="block text-xs text-gray-500 pl-4">{agent.role}</span>
            </button>
          ))}
        </ScrollArea>

        {/* Admin links */}
        {isAdmin && (
          <div className="p-3 border-t border-gray-200 space-y-1.5">
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

        {/* User footer */}
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 px-2">
            {user?.picture && (
              <img src={user.picture} className="w-7 h-7 rounded-full" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-gray-400 hover:text-gray-700 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Schedule banner (admin only) */}
        {isAdmin && schedule?.enabled && schedule.nextRun && (
          <div className="bg-teal-50 border-b border-teal-200 px-6 py-2 text-xs text-teal-700 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            Next agent run: <span className="font-semibold">{formatNextRun(schedule.nextRun)}</span>
          </div>
        )}

        {/* White header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
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
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700 text-sm" data-testid="select-source-filter">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="Dice">Dice</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && (
                <button
                  onClick={handleRunNow}
                  disabled={running}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  {running ? "Running..." : "Run Agents Now"}
                </button>
              )}
            </div>
          </div>

          {/* KPI pills row */}
          <div className="flex flex-wrap gap-3">
            <KPIPill icon={Briefcase} label="Total" value={stats.total} color="text-teal-600" bg="bg-teal-50" />
            <KPIPill icon={CheckCircle} label="Applied" value={stats.Applied || 0} color="text-green-600" bg="bg-green-50" />
            <KPIPill icon={Users} label="Interviews" value={stats.Interview || 0} color="text-purple-600" bg="bg-purple-50" />
            <KPIPill icon={Award} label="Offers" value={stats.Offer || 0} color="text-amber-600" bg="bg-amber-50" />
          </div>
        </div>

        {/* Kanban Board */}
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-20 text-gray-400">Loading jobs...</div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4" style={{ minHeight: "60vh" }}>
              {KANBAN_COLUMNS.map((col) => {
                const colJobs = jobsByStatus[col.status] || [];
                return (
                  <div
                    key={col.status}
                    className="flex-1 min-w-[240px] max-w-[320px] flex flex-col"
                  >
                    {/* Column header */}
                    <div className={`${col.headerBg} border ${col.headerBorder} rounded-t-lg px-3 py-2 flex items-center gap-2`}>
                      <span className={`w-2 h-2 rounded-full ${col.dotBg}`} />
                      <span className={`text-xs font-bold uppercase tracking-wider ${col.headerText}`}>
                        {col.label}
                      </span>
                      <span className={`ml-auto text-xs font-semibold ${col.headerText}`}>
                        {colJobs.length}
                      </span>
                    </div>

                    {/* Column body */}
                    <div className="flex-1 bg-gray-100 border-x border-b border-gray-200 rounded-b-lg p-2 space-y-2 overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
                      {colJobs.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-xs">No jobs</div>
                      ) : (
                        colJobs.map((job) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            showAgent={showAgentOnCard}
                            onStatusChange={(status) =>
                              statusMutation.mutate({ id: job.id, status })
                            }
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
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

function KPIPill({
  icon: Icon,
  label,
  value,
  color,
  bg,
}: {
  icon: any;
  label: string;
  value: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-2`}>
      <Icon className={`w-4 h-4 ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`text-sm font-bold ${color}`}>{value}</span>
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
  const isDice = job.source === "Dice";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">
      {/* Title */}
      <p className="text-xs font-semibold text-gray-900 line-clamp-2 mb-1" title={job.title}>
        {job.title}
      </p>

      {/* Company */}
      <p className="text-[11px] text-gray-500 mb-1">{job.company}</p>

      {/* Location */}
      <p className="text-[10px] text-gray-400 mb-2">{job.location}</p>

      {/* Source badge + agent */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isDice
              ? "bg-orange-100 text-orange-600"
              : "bg-blue-100 text-blue-600"
          }`}
        >
          {job.source}
        </span>
        {showAgent && (
          <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
            <span className={`w-1.5 h-1.5 rounded-full ${AGENT_DOT_COLORS[job.agent] || "bg-gray-400"}`} />
            {allAgents.find((a) => a.id === job.agent)?.name || job.agent}
          </span>
        )}
      </div>

      {/* Actions: status change + apply */}
      <div className="flex items-center justify-between">
        <Select value={job.status} onValueChange={onStatusChange}>
          <SelectTrigger className="h-6 w-[90px] text-[10px] bg-gray-50 border-gray-200 px-1.5 focus:ring-0" data-testid={`select-status-${job.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          onClick={() => window.open(job.job_url, "_blank")}
          className="flex items-center gap-1 text-[10px] font-semibold text-teal-600 hover:text-teal-700 transition-colors"
          data-testid={`button-apply-${job.id}`}
        >
          <ExternalLink className="w-3 h-3" />
          Apply
        </button>
      </div>
    </div>
  );
}
