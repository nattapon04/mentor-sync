"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Users, FileText, Activity, BarChart2, Medal, CheckCircle2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie } from "recharts";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { TIME_RANGE_OPTIONS, TimeRange } from "@/lib/constants";

interface DepartmentStat {
  department: string;
  mentee_count: number;
  total_tickets: number;
  pass_rate_percent: number;
}

interface ReportData {
  total_evaluations: number;
  total_badges: number;
  department_stats: DepartmentStat[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function Reports() {
  const { t } = useLanguage();
  const { token } = useAuth();

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const fetchReports = async () => {
      try {
        const params: Record<string, string> = {};
        if (timeRange !== "all") {
          const start = new Date();
          start.setDate(start.getDate() - parseInt(timeRange));
          params.start_date = start.toISOString().split('T')[0];
        }
        const { data } = await api.get("/reports/team", { params });
        setReportData(data);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, t('failedToLoadReports')));
      } finally {
        setIsLoading(false);
      }
    };
    fetchReports();
  }, [token, timeRange]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) return <div className="text-center p-12 text-muted-foreground">{t('loadingReports')}</div>;
  if (!reportData) return (
    <div className="max-w-6xl mx-auto pb-12">
      <ErrorBanner message={error || t('failedToLoadReports')} />
    </div>
  );

  const totalMentees = reportData.department_stats.reduce((acc, stat) => acc + stat.mentee_count, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{t('teamReports')}</h1>
          <p className="text-muted-foreground mt-1">{t('aggregatedMetricsDesc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
            {TIME_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
          <button onClick={handlePrint} className="bg-primary text-primary-foreground px-5 py-2.5 rounded-xl shadow-sm text-sm font-bold hover:bg-primary/90 transition-colors">
            {t('downloadPdf')}
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('totalMentees')}</h3>
            <div className="bg-blue-500/10 p-2 rounded-xl"><Users className="w-5 h-5 text-blue-500" /></div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{totalMentees}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('ticketsEvaluated')}</h3>
            <div className="bg-purple-500/10 p-2 rounded-xl"><FileText className="w-5 h-5 text-purple-500" /></div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{reportData.total_evaluations}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('badgesAwarded')}</h3>
            <div className="bg-amber-500/10 p-2 rounded-xl"><Medal className="w-5 h-5 text-amber-500" /></div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">{reportData.total_badges}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">{t('avgCompliance')}</h3>
            <div className="bg-emerald-500/10 p-2 rounded-xl"><CheckCircle2 className="w-5 h-5 text-emerald-500" /></div>
          </div>
          <p className="text-3xl font-extrabold text-foreground">
            {reportData.department_stats.length > 0
              ? (reportData.department_stats.reduce((acc, stat) => acc + stat.pass_rate_percent, 0) / reportData.department_stats.length).toFixed(1)
              : 0}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-primary" /> {t('departmentSlaPassRate')}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData.department_stats} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: "var(--foreground)", fontSize: 12 }} />
                <YAxis dataKey="department" type="category" tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 'bold' }} width={100} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                <Bar dataKey="pass_rate_percent" radius={[0, 4, 4, 0]}>
                  {reportData.department_stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" /> {t('ticketsEvaluatedPerDept')}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reportData.department_stats}
                  dataKey="total_tickets"
                  nameKey="department"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  label={({ name, percent = 0 }: { name?: string; percent?: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {reportData.department_stats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
