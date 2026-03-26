import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { agents as allAgents, JOB_STATUSES } from "@shared/schema";
import type { HubJob, Agent } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ChevronDown,
  Play,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";

interface JobsResponse {
  jobs: HubJob[];
  stats: Record<string, number>;
}

function KPICard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <Card className="bg-card border-card-border">
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}20`, color }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground leading-none" data-testid={`text-kpi-${label.toLowerCase()}`}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const colorMap: Record<string, string> = {
    New: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    Applied: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    Interview: "bg-purple-500/15 text-purple-400 border-purple-500/20",
    Offer: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    Rejected: "bg-red-500/15 text-red-400 border-red-500/20",
    Pending: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    Skipped: "bg-gray-500/15 text-gray-400 border-gray-500/20",
  };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${colorMap[normalized] || ""}`}>
      {normalized}
    </Badge>
  );
}

function SourceBadge({ source }: { source: string }) {
  const isDice = source === "Dice";
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${
        isDice
          ? "bg-orange-500/15 text-orange-400 border-orange-500/20"
          : "bg-blue-500/15 text-blue-400 border-blue-500/20"
      }`}
    >
      {source}
    </Badge>
  );
}

function AgentBadge({ agentId }: { agentId: string }) {
  const agent = allAgents.find((a) => a.id === agentId);
  if (!agent) return <span className="text-xs text-muted-foreground">{agentId}</span>;
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: `${agent.color}20`,
        color: agent.color,
      }}
    >
      {agent.name}
    </span>
  );
}

export default function DashboardPage() {
  const { user, isAdmin, agents: userAgents, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [running, setRunning] = useState(false);

  const handleRunNow = async () => {
    if (running) return;
    setRunning(true);
    try {
      await apiRequest("POST", "/api/agents/run-now");
    } catch (err) {
      console.error("Run agents failed:", err);
    }
    // Keep running state for 30s then reset
    setTimeout(() => {
      setRunning(false);
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
    }, 30000);
  };

  const queryParams = new URLSearchParams();
  if (selectedAgent !== "all") queryParams.set("agent", selectedAgent);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (sourceFilter !== "all") queryParams.set("source", sourceFilter);

  const { data, isLoading } = useQuery<JobsResponse>({
    queryKey: ["/api/jobs", selectedAgent, statusFilter, sourceFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedAgent !== "all") params.set("agent", selectedAgent);
      if (statusFilter !== "all") params.set("status", statusFilter);
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
  const showAgentColumn = selectedAgent === "all" && userAgents.length > 1;

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <svg width="28" height="28" viewBox="0 0 44 44" fill="none">
              <rect x="2" y="2" width="40" height="40" rx="10" stroke="hsl(174, 72%, 46%)" strokeWidth="2.5" fill="none" />
              <circle cx="22" cy="16" r="5" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" />
              <path d="M12 34c0-6 4-10 10-10s10 4 10 10" stroke="hsl(174, 72%, 46%)" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-bold text-sidebar-foreground">Agent Hub</span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2">AGENTS</p>

          {/* All Agents option for admin */}
          {isAdmin && (
            <button
              onClick={() => setSelectedAgent("all")}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
                selectedAgent === "all"
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
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
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}
              data-testid={`button-agent-${agent.id}`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: agent.color }}
              />
              {agent.name}
              <span className="block text-xs text-muted-foreground pl-4">{agent.role}</span>
            </button>
          ))}
        </ScrollArea>

        {/* Admin Panel button */}
        {isAdmin && (
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={() => setLocation("/admin")}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex items-center gap-2"
              data-testid="button-admin-panel"
            >
              <Shield className="w-4 h-4" />
              Admin Panel
            </button>
          </div>
        )}

        {/* User footer */}
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2 px-2">
            {user?.picture && (
              <img src={user.picture} className="w-7 h-7 rounded-full" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground" data-testid="text-dashboard-title">
                {selectedAgent === "all"
                  ? "All Agents Dashboard"
                  : `${allAgents.find((a) => a.id === selectedAgent)?.name || ""} Dashboard`}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedAgent === "all"
                  ? "Overview of all agent job tracking"
                  : allAgents.find((a) => a.id === selectedAgent)?.role || ""}
              </p>
            </div>
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

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <KPICard label="Total Jobs" value={stats.total} icon={Briefcase} color="hsl(174, 72%, 46%)" />
            <KPICard label="Applied" value={stats.Applied || 0} icon={CheckCircle} color="hsl(142, 71%, 45%)" />
            <KPICard label="Interviews" value={stats.Interview || 0} icon={Users} color="hsl(262, 72%, 56%)" />
            <KPICard label="Pending" value={(stats.Pending || 0) + (stats.New || 0)} icon={Clock} color="hsl(38, 92%, 50%)" />
            <KPICard label="Offers" value={stats.Offer || 0} icon={Award} color="hsl(340, 75%, 55%)" />
          </div>

          {/* Filters */}
          <div className="flex gap-3 mb-4 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] bg-card border-card-border" data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {JOB_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[140px] bg-card border-card-border" data-testid="select-source-filter">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="Dice">Dice</SelectItem>
                <SelectItem value="LinkedIn">LinkedIn</SelectItem>
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground self-center">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </div>
          </div>

          {/* Jobs Table */}
          <Card className="bg-card border-card-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Company</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Source</th>
                    {showAgentColumn && (
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Agent</th>
                    )}
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td colSpan={showAgentColumn ? 7 : 6} className="px-4 py-3">
                          <div className="h-4 bg-muted rounded animate-pulse" />
                        </td>
                      </tr>
                    ))
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={showAgentColumn ? 7 : 6} className="text-center py-12 text-muted-foreground">
                        No jobs found
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="border-b border-border hover:bg-muted/20 transition-colors" data-testid={`row-job-${job.id}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-foreground line-clamp-1" title={job.title}>
                            {job.title}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{job.company}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{job.location}</td>
                        <td className="px-4 py-3">
                          <SourceBadge source={job.source} />
                        </td>
                        {showAgentColumn && (
                          <td className="px-4 py-3">
                            <AgentBadge agentId={job.agent} />
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <Select
                            value={job.status}
                            onValueChange={(status) =>
                              statusMutation.mutate({ id: job.id, status })
                            }
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs bg-transparent border-none p-0 focus:ring-0" data-testid={`select-status-${job.id}`}>
                              <StatusBadge status={job.status} />
                            </SelectTrigger>
                            <SelectContent>
                              {JOB_STATUSES.map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary hover:text-primary"
                            onClick={() => window.open(job.job_url, "_blank")}
                            data-testid={`button-apply-${job.id}`}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Apply
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Footer */}
          <footer className="mt-8 pb-4 text-center">
            <a
              href="https://www.perplexity.ai/computer"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Balaji Agent Hub · Powered by Perplexity Computer
            </a>
          </footer>
        </div>
      </main>
    </div>
  );
}
