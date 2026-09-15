"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import {
  Users, Medal, MessageSquare, TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronUp, CheckCircle2
} from "lucide-react";
import {
  LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid
} from "recharts";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { TIME_RANGE_OPTIONS, TimeRange, getStartDateParam } from "@/lib/constants";
import { User } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenteeReport {
  mentee: User;
  mentors: User[];
  total_evaluations: number;
  pass_rate_percent: number;
  pass_rate_trend: number[];
  total_badges: number;
  positive_notes: number;
  neutral_notes: number;
  constructive_notes: number;
  status: "on_track" | "at_risk" | "off_track";
}

interface MenteeReportsResponse {
  mentees: MenteeReport[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  on_track: {
    label: "On Track",
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
  },
  at_risk: {
    label: "At Risk",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
  },
  off_track: {
    label: "Off Track",
    className: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
  },
};

function TrendIcon({ trend }: { trend: number[] }) {
  if (trend.length < 2) return <Minus className="w-4 h-4 text-muted-foreground" />;
  const diff = trend[trend.length - 1] - trend[trend.length - 2];
  if (diff > 2) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (diff < -2) return <TrendingDown className="w-4 h-4 text-rose-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

// ─── MenteeCard ──────────────────────────────────────────────────────────────

function MenteeCard({ report }: { report: MenteeReport }) {
  const [expanded, setExpanded] = useState(false);

  const status = STATUS_CONFIG[report.status];
  const sparklineData = report.pass_rate_trend.map((rate, i) => ({
    eval: `#${i + 1}`,
    rate: Math.round(rate),
  }));

  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden transition-shadow hover:shadow-md">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: Name + Mentors */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground text-base truncate">{report.mentee.name}</h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${status.className}`}>
                {status.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{report.mentee.email}</p>
            {report.mentors.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {report.mentors.map((m) => (
                  <span key={m.id} className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-md font-semibold">
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right: Pass Rate */}
          <div className="text-right flex-shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <TrendIcon trend={report.pass_rate_trend} />
              <span className="text-2xl font-extrabold text-foreground">
                {report.pass_rate_percent.toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Pass Rate</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${status.bar}`}
            style={{ width: `${Math.min(100, report.pass_rate_percent)}%` }}
          />
        </div>

        {/* Stats Row */}
        <div className="mt-4 grid grid-cols-4 gap-3 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">{report.total_evaluations}</p>
            <p className="text-[11px] text-muted-foreground">Evaluations</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{report.total_badges}</p>
            <p className="text-[11px] text-muted-foreground">Badges</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-500">{report.positive_notes}</p>
            <p className="text-[11px] text-muted-foreground">Positive</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-500">{report.constructive_notes}</p>
            <p className="text-[11px] text-muted-foreground">Constructive</p>
          </div>
        </div>
      </div>

      {/* Expandable Sparkline */}
      {sparklineData.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="w-full flex items-center justify-center gap-1 py-2.5 border-t border-border text-xs text-muted-foreground hover:bg-muted/30 transition-colors font-semibold"
          >
            {expanded ? <><ChevronUp className="w-3.5 h-3.5" /> Hide trend</> : <><ChevronDown className="w-3.5 h-3.5" /> Show trend</>}
          </button>

          {expanded && (
            <div className="px-5 pb-5 border-t border-border pt-4 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground mb-3">Pass Rate Trend (last {sparklineData.length} evaluations)</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="eval" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} unit="%" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: 8 }}
                      formatter={(v: unknown) => [`${typeof v === "number" ? v.toFixed(0) : 0}%`, "Pass Rate"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="rate"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ fill: "var(--primary)", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const { t } = useLanguage();
  const { token, user } = useAuth();

  const [reportData, setReportData] = useState<MenteeReportsResponse | null>(null);
  const [mentors, setMentors] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  // A mentor sees only their own mentees by default; an admin with no mentor role of their own
  // has no "own mentees" to scope to, so they still default to the full team-wide view.
  const [mentorFilter, setMentorFilter] = useState<string>(() =>
    user?.roles?.includes("mentor") ? user.id : ""
  );
  const [search, setSearch] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Fetch available mentors for the filter dropdown
  useEffect(() => {
    if (!token) return;
    api.get("/users").then(({ data }) => {
      const list: User[] = Array.isArray(data) ? data : data.data ?? [];
      setMentors(list.filter((u) => u.roles?.includes("mentor")));
    }).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const fetchReports = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string> = {};
        const startDate = getStartDateParam(timeRange);
        if (startDate) params.start_date = startDate;
        if (mentorFilter) params.mentor_id = mentorFilter;
        const { data } = await api.get<MenteeReportsResponse>("/reports/mentees", { params });
        setReportData(data);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, t("failedToLoadReports")));
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, [token, timeRange, mentorFilter]);

  // Client-side search filter
  const filtered = (reportData?.mentees ?? []).filter((r) =>
    r.mentee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.mentee.email.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: off_track first, then at_risk, then on_track
  const ORDER = { off_track: 0, at_risk: 1, on_track: 2 };
  const sorted = [...filtered].sort((a, b) => ORDER[a.status] - ORDER[b.status]);

  // Summary stats
  const totalMentees = filtered.length;
  const onTrack = filtered.filter((r) => r.status === "on_track").length;
  const atRisk = filtered.filter((r) => r.status === "at_risk").length;
  const offTrack = filtered.filter((r) => r.status === "off_track").length;
  const avgPassRate = totalMentees > 0
    ? filtered.reduce((acc, r) => acc + r.pass_rate_percent, 0) / totalMentees
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Mentee Reports</h1>
          <p className="text-muted-foreground mt-1">Individual progress, trends and performance per mentee</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Search mentee..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 w-40"
          />
          <select
            value={mentorFilter}
            onChange={(e) => setMentorFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">All Mentors</option>
            {mentors.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {TIME_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
            ))}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Summary KPI Row */}
      {!isLoading && reportData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">Total Mentees</span>
              <div className="bg-blue-500/10 p-2 rounded-xl"><Users className="w-4 h-4 text-blue-500" /></div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{totalMentees}</p>
          </div>
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">Avg Pass Rate</span>
              <div className="bg-emerald-500/10 p-2 rounded-xl"><CheckCircle2 className="w-4 h-4 text-emerald-500" /></div>
            </div>
            <p className="text-3xl font-extrabold text-foreground">{avgPassRate.toFixed(1)}%</p>
          </div>
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">On Track</span>
              <div className="bg-emerald-500/10 p-2 rounded-xl"><TrendingUp className="w-4 h-4 text-emerald-500" /></div>
            </div>
            <p className="text-3xl font-extrabold text-emerald-500">{onTrack}</p>
          </div>
          <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">Needs Attention</span>
              <div className="bg-rose-500/10 p-2 rounded-xl"><TrendingDown className="w-4 h-4 text-rose-500" /></div>
            </div>
            <p className="text-3xl font-extrabold text-rose-500">{atRisk + offTrack}</p>
          </div>
        </div>
      )}

      {/* Status Legend */}
      {!isLoading && reportData && totalMentees > 0 && (
        <div className="flex flex-wrap gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> On Track (≥80%) — {onTrack}
          </span>
          <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> At Risk (50–79%) — {atRisk}
          </span>
          <span className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Off Track (&lt;50%) — {offTrack}
          </span>
        </div>
      )}

      {/* Mentee Cards Grid */}
      {isLoading ? (
        <div className="text-center p-12 text-muted-foreground">{t("loadingReports")}</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Medal className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No mentees found</p>
          <p className="text-sm mt-1">Try adjusting the filters above</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {sorted.map((report) => (
            <MenteeCard key={report.mentee.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
