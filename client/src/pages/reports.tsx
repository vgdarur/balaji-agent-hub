import { useState, useEffect } from "react";
import { agents as allAgents } from "@shared/schema";
import {
  ArrowLeft,
  RefreshCw,
  BarChart2,
  Clock,
} from "lucide-react";

interface AuthUser {
  email: string;
  name: string;
  picture: string;
}

interface DailyRun {
  agent: string;
  run_date: string;
  jobs_found: number;
  sources_searched: string;
  status: string;
  completed_at: string;
}

interface TotalRow {
  agent: string;
  status: string;
  count: string;
}

interface StatusBreakdown {
  agent: string;
  new_count: string;
  applied_count: string;
  interview_count: string;
  offer_count: string;
  rejected_count: string;
  total_count: string;
}

interface FailedRun {
  agent: string;
  run_date: string;
  status: string;
  completed_at: string;
}

interface ReportsData {
  dailyRuns: DailyRun[];
  totals: TotalRow[];
  statusBreakdown: StatusBreakdown[];
  failedRuns: FailedRun[];
}

interface ScheduleConfig {
  enabled: boolean;
  time: string;
  nextRun: string;
  lastRun: string;
}

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

const TIME_OPTIONS = [
  { value: "05:00", label: "5:00 AM ET" },
  { value: "06:00", label: "6:00 AM ET" },
  { value: "07:00", label: "7:00 AM ET" },
  { value: "08:00", label: "8:00 AM ET" },
  { value: "09:00", label: "9:00 AM ET" },
];

function agentName(id: string) {
  return allAgents.find((a) => a.id === id)?.name || id;
}

function agentRole(id: string) {
  return allAgents.find((a) => a.id === id)?.role || "";
}

function dotClass(id: string) {
  return AGENT_DOT_COLORS[id] || "bg-gray-400";
}

function formatTime(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(d: string) {
  if (!d) return "—";
  const date = new Date(d);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) return `Today ${time}`;
  if (isTomorrow) return `Tomorrow ${time}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " + time;
}

export default function ReportsPage({
  user,
  onBack,
}: {
  user: AuthUser;
  onBack: () => void;
}) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingSchedule, setUpdatingSchedule] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, scheduleRes] = await Promise.all([
        fetch("/api/admin/reports"),
        fetch("/api/admin/schedule"),
      ]);
      if (!reportsRes.ok) throw new Error(`Error ${reportsRes.status}`);
      const reportsJson = await reportsRes.json();
      setData(reportsJson);
      if (scheduleRes.ok) {
        setSchedule(await scheduleRes.json());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateSchedule = async (updates: Partial<ScheduleConfig>) => {
    setUpdatingSchedule(true);
    try {
      const res = await fetch("/api/admin/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setSchedule(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setUpdatingSchedule(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Build today's runs — group by agent, most recent first
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRuns = data?.dailyRuns.filter(
    (r) => r.run_date?.slice(0, 10) === todayStr
  ) || [];

  // Build per-agent card data from status breakdown
  const cardData = (data?.statusBreakdown || []).map((row) => {
    const todayRun = todayRuns.find((r) => r.agent === row.agent);
    return {
      agent: row.agent,
      name: agentName(row.agent),
      role: agentRole(row.agent),
      todayJobs: todayRun?.jobs_found || 0,
      applied: parseInt(row.applied_count) || 0,
      interview: parseInt(row.interview_count) || 0,
      offer: parseInt(row.offer_count) || 0,
      rejected: parseInt(row.rejected_count) || 0,
      total: parseInt(row.total_count) || 0,
      lastRun: todayRun?.completed_at || "",
      status: todayRun ? todayRun.status : "no_run",
      isFailed: data?.failedRuns.some(
        (f) => f.agent === row.agent && f.run_date?.slice(0, 10) === todayStr
      ),
    };
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* Top bar */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-orange-500" />
            <h1 className="text-lg font-bold text-gray-900">Agent Reports</h1>
          </div>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors border border-gray-200"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Date header */}
        <p className="text-sm text-gray-500">{today}</p>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Scheduler control */}
        {schedule && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Auto-Scheduler
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {/* Toggle */}
              <button
                disabled={updatingSchedule}
                onClick={() => updateSchedule({ enabled: !schedule.enabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  schedule.enabled ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                    schedule.enabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${schedule.enabled ? "text-green-700" : "text-gray-400"}`}>
                {schedule.enabled ? "ON" : "OFF"}
              </span>

              {/* Time picker */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Run time:</span>
                <select
                  value={schedule.time}
                  onChange={(e) => updateSchedule({ time: e.target.value })}
                  disabled={updatingSchedule}
                  className="text-sm border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700"
                >
                  {TIME_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div className="ml-auto text-xs text-gray-400 space-y-0.5 text-right">
                {schedule.enabled ? (
                  <div>Next run: <span className="text-gray-600">{formatDateTime(schedule.nextRun)}</span></div>
                ) : (
                  <div className="text-gray-400">Disabled</div>
                )}
                {schedule.lastRun && (
                  <div>Last run: <span className="text-gray-600">{formatDateTime(schedule.lastRun)}</span></div>
                )}
              </div>
            </div>
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20 text-gray-400">Loading reports...</div>
        )}

        {data && (
          <>
            {/* Section 1 — Today's Run (Jira-style card grid) */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Today's Run
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cardData.length === 0 ? (
                  <div className="text-gray-400 text-sm col-span-full text-center py-8 bg-white rounded-xl border border-gray-200">
                    No agent data yet
                  </div>
                ) : (
                  cardData.map((card) => (
                    <div
                      key={card.agent}
                      className="bg-orange-50 border border-orange-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Header: name + dot */}
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass(card.agent)}`} />
                        <span className="text-sm font-bold text-gray-900 truncate">
                          {card.name}
                        </span>
                      </div>
                      {/* Role */}
                      <p className="text-xs text-gray-500 mb-3 truncate">{card.role}</p>

                      {/* Big number */}
                      <div className="text-center mb-3">
                        <span className="text-3xl font-bold text-gray-800">{card.todayJobs}</span>
                        <span className="text-xs text-gray-500 ml-1">jobs today</span>
                      </div>

                      {/* Status pills */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                          Applied {card.applied}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200">
                          Interview {card.interview}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                          Offer {card.offer}
                        </span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                          Rejected {card.rejected}
                        </span>
                      </div>

                      {/* Footer: last run + status */}
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400">
                          {card.lastRun ? `Last: ${formatTime(card.lastRun)}` : "No runs today"}
                        </span>
                        {card.isFailed ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold">
                            Failed
                          </span>
                        ) : card.status === "completed" ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 font-semibold">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">
                            Idle
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Section 2 — All Time Totals Table */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                All Time Totals
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Total</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Applied</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Interview</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Offer</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statusBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-400">
                            No data
                          </td>
                        </tr>
                      ) : (
                        data.statusBreakdown.map((row) => (
                          <tr
                            key={row.agent}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass(row.agent)}`} />
                                <span className="text-gray-800 font-medium">{agentName(row.agent)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-gray-900 font-bold">
                              {row.total_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-emerald-600">
                              {row.applied_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-purple-600">
                              {row.interview_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-amber-600">
                              {row.offer_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-red-600">
                              {row.rejected_count}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* Section 3 — Recent Runs */}
            <section>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Recent Runs
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Jobs</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Source</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dailyRuns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-400">
                            No runs recorded yet
                          </td>
                        </tr>
                      ) : (
                        data.dailyRuns.slice(0, 20).map((run, i) => (
                          <tr
                            key={`${run.agent}-${run.run_date}-${i}`}
                            className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-2.5 text-gray-500">
                              {new Date(run.run_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass(run.agent)}`} />
                                <span className="text-gray-800">{agentName(run.agent)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-700 font-medium">{run.jobs_found}</td>
                            <td className="px-4 py-2.5 text-gray-500">{run.sources_searched || "—"}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  run.status === "completed"
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : "bg-red-100 text-red-700 border border-red-200"
                                }`}
                              >
                                {run.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
