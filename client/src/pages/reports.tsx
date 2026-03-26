import { useState, useEffect } from "react";
import { agents as allAgents } from "@shared/schema";
import {
  ArrowLeft,
  RefreshCw,
  BarChart2,
  AlertTriangle,
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

function agentName(id: string) {
  return allAgents.find((a) => a.id === id)?.name || id;
}

function agentColor(id: string) {
  return allAgents.find((a) => a.id === id)?.color || "hsl(0,0%,60%)";
}

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportsPage({
  user,
  onBack,
}: {
  user: AuthUser;
  onBack: () => void;
}) {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reports");
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Build per-agent totals from the totals array
  const agentTotals: Record<string, Record<string, number>> = {};
  if (data) {
    for (const row of data.totals) {
      if (!agentTotals[row.agent]) agentTotals[row.agent] = {};
      agentTotals[row.agent][row.status] = parseInt(row.count) || 0;
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-[#0f0f18] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="h-5 w-px bg-gray-700" />
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-blue-400" />
            <h1 className="text-lg font-bold text-white">Admin Reports</h1>
          </div>
        </div>
        <button
          onClick={fetchReports}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 text-xs font-medium hover:bg-gray-700 transition-colors border border-gray-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && !data && (
          <div className="text-center py-20 text-gray-500">Loading reports...</div>
        )}

        {data && (
          <>
            {/* Section 1 — Daily Agent Runs */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Daily Agent Runs
              </h2>
              <div className="bg-[#12121c] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-[#16162a]">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Agent</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Jobs Found</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Source</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dailyRuns.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-gray-600">
                            No runs recorded yet
                          </td>
                        </tr>
                      ) : (
                        data.dailyRuns.map((run, i) => (
                          <tr
                            key={`${run.agent}-${run.run_date}-${i}`}
                            className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-2.5 text-gray-400">{formatDate(run.run_date)}</td>
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: agentColor(run.agent) }}
                                />
                                <span className="text-gray-200">{agentName(run.agent)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-300 font-medium">{run.jobs_found}</td>
                            <td className="px-4 py-2.5 text-gray-400">{run.sources_searched || "—"}</td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  run.status === "completed"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                    : "bg-red-500/15 text-red-400 border border-red-500/20"
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

            {/* Section 2 — Total Applications Per Candidate */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Total Applications Per Candidate
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Object.keys(agentTotals).length === 0 ? (
                  <div className="text-gray-600 text-sm col-span-full text-center py-8">
                    No application data yet
                  </div>
                ) : (
                  Object.entries(agentTotals).map(([agentId, statuses]) => {
                    const total = Object.values(statuses).reduce((a, b) => a + b, 0);
                    return (
                      <div
                        key={agentId}
                        className="bg-[#12121c] border border-gray-800 rounded-xl p-4"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: agentColor(agentId) }}
                          />
                          <span className="text-sm font-semibold text-white">
                            {agentName(agentId)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Total</span>
                            <span className="text-white font-bold">{total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Applied</span>
                            <span className="text-emerald-400">{statuses["Applied"] || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Interview</span>
                            <span className="text-purple-400">{statuses["Interview"] || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Offer</span>
                            <span className="text-amber-400">{statuses["Offer"] || 0}</span>
                          </div>
                          <div className="flex justify-between col-span-2">
                            <span className="text-gray-500">Rejected</span>
                            <span className="text-red-400">{statuses["Rejected"] || 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* Section 3 — Job Status Breakdown */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Job Status Breakdown
              </h2>
              <div className="bg-[#12121c] border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-[#16162a]">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Agent</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Total</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Applied</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Interview</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Offer</th>
                        <th className="text-right px-4 py-3 font-medium text-gray-500">Rejected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statusBreakdown.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-8 text-gray-600">
                            No data
                          </td>
                        </tr>
                      ) : (
                        data.statusBreakdown.map((row) => (
                          <tr
                            key={row.agent}
                            className="border-b border-gray-800/50 hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: agentColor(row.agent) }}
                                />
                                <span className="text-gray-200">{agentName(row.agent)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right text-white font-bold">
                              {row.total_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-emerald-400">
                              {row.applied_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-purple-400">
                              {row.interview_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-amber-400">
                              {row.offer_count}
                            </td>
                            <td className="px-4 py-2.5 text-right text-red-400">
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

            {/* Section 4 — Failed Runs */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                Failed Runs
              </h2>
              <div className="bg-[#12121c] border border-red-500/20 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 bg-red-500/5">
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Agent</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-gray-500">
                          Completed At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.failedRuns.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-gray-600">
                            No failed runs — all clear!
                          </td>
                        </tr>
                      ) : (
                        data.failedRuns.map((run, i) => (
                          <tr
                            key={`${run.agent}-${run.run_date}-${i}`}
                            className="border-b border-gray-800/50 bg-red-500/[0.03] hover:bg-red-500/[0.06] transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <span className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: agentColor(run.agent) }}
                                />
                                <span className="text-gray-200">{agentName(run.agent)}</span>
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-400">{formatDate(run.run_date)}</td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
                                {run.status}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">
                              {run.completed_at
                                ? new Date(run.completed_at).toLocaleString()
                                : "—"}
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
