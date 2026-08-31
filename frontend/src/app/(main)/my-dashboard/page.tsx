"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { FileSpreadsheet, Medal, Star } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { EarnedBadge, GeneralNote, Evaluation } from "@/types";
import { TIME_RANGE_OPTIONS, TimeRange, getStartDateParam } from "@/lib/constants";
import { DictionaryKey } from "@/locales/dictionary";
import { FocusAreasPanel } from "@/components/FocusAreasPanel";

export default function MyDashboard() {
  const { t } = useLanguage();
  const { user, token } = useAuth();

  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) return;
    const fetchData = async () => {
      try {
        const params: Record<string, string> = { mentee_id: user.id };
        const startDate = getStartDateParam(timeRange);
        if (startDate) params.start_date = startDate;

        const [evalsRes, badgesRes, notesRes] = await Promise.all([
          api.get("/evaluations", { params }),
          api.get("/badges", { params: { mentee_id: user.id } }),
          api.get("/notes", { params: { mentee_id: user.id } })
        ]);
        setEvaluations(evalsRes.data);
        setBadges(badgesRes.data);
        setNotes(notesRes.data);
        setError(null);
      } catch (err) {
        setError(getErrorMessage(err, t('failedToLoadData')));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, token, timeRange]);

  const performanceData = useMemo(() => {
    if (!evaluations || evaluations.length === 0) return [];

    const stats: Record<string, { total: number, pass: number }> = {
      'Quality': { total: 0, pass: 0 },
      'Velocity': { total: 0, pass: 0 },
      'Soft Skills': { total: 0, pass: 0 },
    };

    evaluations.forEach(ev => {
      ev.metrics?.forEach((m) => {
        if (!m.is_enabled || (m.value_string !== 'Pass' && m.value_string !== 'Fail')) return;

        let bucket = 'Soft Skills';
        if (m.sla_rule?.metric_type === 'quality') bucket = 'Quality';
        else if (m.sla_rule?.metric_type === 'velocity') bucket = 'Velocity';

        stats[bucket].total += 1;
        if (m.value_string === 'Pass') stats[bucket].pass += 1;
      });
    });

    return [
      { subject: t('quality'), A: stats['Quality'].total ? Math.round((stats['Quality'].pass / stats['Quality'].total) * 100) : 0, fullMark: 100 },
      { subject: t('velocity'), A: stats['Velocity'].total ? Math.round((stats['Velocity'].pass / stats['Velocity'].total) * 100) : 0, fullMark: 100 },
      { subject: t('softSkill'), A: stats['Soft Skills'].total ? Math.round((stats['Soft Skills'].pass / stats['Soft Skills'].total) * 100) : 0, fullMark: 100 },
    ];
  }, [evaluations]);

  if (isLoading) return <div className="text-center p-12 text-muted-foreground">{t('loadingDashboard')}</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{t('myDashboard')}</h1>
          <p className="text-muted-foreground mt-1">{t('jiraDrivenPerformanceDesc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
            {TIME_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Gamification Wall */}
      <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-500/20 rounded-3xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
          <Medal className="w-5 h-5 text-amber-500"/>
          {t('wallOfAchievements')}
        </h2>
        {badges.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('noBadgesEarned')}</p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            {badges.map(b => (
              <div key={b.id} className="bg-card border border-amber-500/30 p-3 rounded-2xl flex items-center gap-3 shadow-sm hover:scale-105 transition-transform">
                <div className="bg-amber-500/10 p-2 rounded-full">
                  <Star className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground capitalize">{b.badge_type.replace('_', ' ')}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {t(`badge_${b.badge_type}` as DictionaryKey)}
                  </p>
                  <p className="text-[10px] font-bold text-amber-500 uppercase mt-1">
                    {b.awarded_by?.name ? `${t('awardedBy')} ${b.awarded_by.name}` : t('autoAwardedBySystem')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Overview */}
      <h2 className="text-xl font-bold text-foreground">{t('performanceOverview')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">{t('performanceRadar')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={performanceData}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
                <Radar name="Score" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-foreground mb-4">{t('recentScores')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <XAxis dataKey="subject" tick={{ fill: "var(--foreground)", fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: "var(--card)", borderColor: "var(--border)", color: "var(--foreground)" }} />
                <Bar dataKey="A" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <FocusAreasPanel evaluations={evaluations} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-bold text-foreground">{t('recentJiraTickets')}</h2>
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {evaluations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">{t('noEvaluationsYet')}</div>
            ) : (
              <div className="divide-y divide-border">
                {evaluations.slice(0, 5).map(ev => (
                  <div key={ev.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <FileSpreadsheet className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{ev.reference_id}</p>
                        <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-xs font-bold px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded">
                      {t('pass')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-xl font-bold text-foreground">{t('feedbackNotes')}</h2>
          <div className="space-y-3">
            {notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('noNotesYet')}</p>
            ) : (
              notes.map(n => (
                <div key={n.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{n.note_type === 'positive' ? '🟢' : n.note_type === 'constructive' ? '🟡' : '⚪'}</span>
                    <span className="font-bold text-sm text-foreground">{n.author?.name}</span>
                  </div>
                  <p className="text-sm text-foreground">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
