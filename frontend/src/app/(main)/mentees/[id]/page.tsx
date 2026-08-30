"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { User, Activity, FileText, ClipboardList, CheckCircle, ChevronLeft, Trash2, Medal, Edit2 } from "lucide-react";
import Link from "next/link";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { User as UserModel, SLARule, MetricInput, Evaluation, EarnedBadge, GeneralNote } from "@/types";
import { TIME_RANGE_OPTIONS, TimeRange } from "@/lib/constants";
import { DictionaryKey } from "@/locales/dictionary";

export default function MenteeDetail() {
  const { t } = useLanguage();
  const { token, user: loggedInUser } = useAuth();
  const params = useParams();
  const menteeId = params.id as string;

  const [activeTab, setActiveTab] = useState<"history" | "evaluate" | "badge" | "note">("history");
  const [mentee, setMentee] = useState<UserModel | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [badges, setBadges] = useState<EarnedBadge[]>([]);
  const [notes, setNotes] = useState<GeneralNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [error, setError] = useState<string | null>(null);

  // Form States
  const [slaRules, setSlaRules] = useState<SLARule[]>([]);
  const [metricInputs, setMetricInputs] = useState<MetricInput[]>([]);
  const [evaluationType, setEvaluationType] = useState<"ticket" | "sprint">("ticket");
  const [referenceId, setReferenceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evalSuccess, setEvalSuccess] = useState(false);

  // Only show rules that apply to the evaluation type currently being filled out,
  // so ticket-level and sprint-level SLAs stay measured separately.
  const visibleRules = useMemo(
    () => slaRules.filter(r => !r.eval_type || r.eval_type === "both" || r.eval_type === evaluationType),
    [slaRules, evaluationType]
  );

  const [selectedBadge, setSelectedBadge] = useState("");
  const [noteType, setNoteType] = useState("positive");
  const [noteMessage, setNoteMessage] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");

  const loadSlaRules = async (dept: string) => {
    try {
      const [globalRes, deptRes] = await Promise.all([
        api.get("/sla-rules", { params: { scope: "global" } }),
        dept ? api.get("/sla-rules", { params: { scope: dept } }) : Promise.resolve(null)
      ]);
      const globalRules = Array.isArray(globalRes.data) ? globalRes.data : [];
      const deptRules = deptRes && Array.isArray(deptRes.data) ? deptRes.data : [];
      const combined: SLARule[] = [...globalRules, ...deptRules];
      setSlaRules(combined);
      setMetricInputs(combined.map(r => ({ sla_rule_id: r.id, value_numeric: "", value_string: "Pass", comment: "", is_enabled: true })));
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
  };

  const fetchData = async () => {
    if (!token || !menteeId) return;
    setIsLoading(true);
    try {
      const userRes = await api.get(`/users/${menteeId}`);
      setMentee(userRes.data);
      loadSlaRules(userRes.data.department);

      const queryParams: Record<string, string> = { mentee_id: menteeId };
      if (timeRange !== "all") {
        const start = new Date();
        start.setDate(start.getDate() - parseInt(timeRange));
        queryParams.start_date = start.toISOString().split('T')[0];
      }

      const [evalsRes, badgesRes, notesRes] = await Promise.all([
        api.get("/evaluations", { params: queryParams }),
        api.get("/badges", { params: { mentee_id: menteeId } }),
        api.get("/notes", { params: { mentee_id: menteeId } })
      ]);
      setEvaluations(evalsRes.data);
      setBadges(badgesRes.data);
      setNotes(notesRes.data);
      setError(null);
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, [token, menteeId, timeRange]);

  // ----- ACTIONS -----
  const handleSubmitEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceId.trim() || !loggedInUser) return;
    setIsSubmitting(true);
    try {
      const visibleRuleIds = new Set(visibleRules.map(r => r.id));
      const payload = {
        mentee_id: menteeId,
        evaluator_id: loggedInUser.id,
        evaluation_type: evaluationType,
        reference_id: referenceId,
        metrics: metricInputs.filter(m => m.is_enabled && visibleRuleIds.has(m.sla_rule_id)).map(m => ({
          sla_rule_id: m.sla_rule_id,
          value_numeric: m.value_numeric ? parseFloat(m.value_numeric) : null,
          value_string: m.value_string,
          comment: m.comment,
          is_enabled: m.is_enabled
        }))
      };
      
      await api.post("/evaluations", payload);
      setEvalSuccess(true);
      setReferenceId("");
      setError(null);
      setTimeout(() => { setEvalSuccess(false); setActiveTab("history"); fetchData(); }, 2000);
    } catch (err) { setError(getErrorMessage(err, t('failedToSubmitEvaluation'))); }
    finally { setIsSubmitting(false); }
  };

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", action: () => {} });

  const handleDeleteEval = (id: string) => {
    setConfirmConfig({
      isOpen: true, title: t('deleteEvalTitle'), message: t('deleteEvalMsg'),
      action: async () => {
        try {
          await api.delete(`/evaluations/${id}`);
          fetchData();
        } catch (err) { setError(getErrorMessage(err, t('failedToDeleteData'))); }
      }
    });
  };

  const handleAwardBadge = async () => {
    if (!selectedBadge || !loggedInUser) return;
    try {
      await api.post("/badges", { mentee_id: menteeId, awarded_by_id: loggedInUser.id, badge_type: selectedBadge });
      setSelectedBadge("");
      fetchData();
    } catch (err) { setError(getErrorMessage(err, t('failedToSaveData'))); }
  };

  const handleDeleteBadge = (id: string) => {
    setConfirmConfig({
      isOpen: true, title: t('deleteBadgeTitle'), message: t('deleteBadgeMsg'),
      action: async () => {
        try {
          await api.delete(`/badges/${id}`);
          fetchData();
        } catch (err) { setError(getErrorMessage(err, t('failedToDeleteData'))); }
      }
    });
  };

  const handleSaveNote = async () => {
    if (!noteMessage.trim() || !loggedInUser) return;
    try {
      if (editingNoteId) {
        await api.put(`/notes/${editingNoteId}`, { note_type: noteType, message: noteMessage });
        setEditingNoteId("");
      } else {
        await api.post("/notes", { mentee_id: menteeId, author_id: loggedInUser.id, note_type: noteType, message: noteMessage });
      }
      setNoteMessage("");
      setNoteType("positive");
      fetchData();
    } catch (err) { setError(getErrorMessage(err, t('failedToSaveData'))); }
  };

  const handleDeleteNote = (id: string) => {
    setConfirmConfig({
      isOpen: true, title: t('deleteNoteTitle'), message: t('deleteNoteMsg'),
      action: async () => {
        try {
          await api.delete(`/notes/${id}`);
          fetchData();
        } catch (err) { setError(getErrorMessage(err, t('failedToDeleteData'))); }
      }
    });
  };

  const startEditNote = (n: GeneralNote) => {
    setEditingNoteId(n.id);
    setNoteType(n.note_type);
    setNoteMessage(n.message);
    setActiveTab("note");
  };

  // ----- CHARTS DATA -----
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
      { subject: t('quality') || 'Quality', A: stats['Quality'].total ? Math.round((stats['Quality'].pass / stats['Quality'].total) * 100) : 0, fullMark: 100 },
      { subject: t('velocity') || 'Velocity', A: stats['Velocity'].total ? Math.round((stats['Velocity'].pass / stats['Velocity'].total) * 100) : 0, fullMark: 100 },
      { subject: t('softSkill') || 'Soft Skills', A: stats['Soft Skills'].total ? Math.round((stats['Soft Skills'].pass / stats['Soft Skills'].total) * 100) : 0, fullMark: 100 },
    ];
  }, [evaluations, t]);
  const metricBadge = (type?: string) => {
    if (type === "quality") return <span className="bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">{t('quality')}</span>;
    if (type === "velocity") return <span className="bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">{t('velocity')}</span>;
    return <span className="bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded">{t('softSkill')}</span>;
  };

  if (isLoading) return <div className="text-center p-12 text-muted-foreground">{t('loadingDetails')}</div>;
  if (!mentee) return <div className="text-center p-12 text-rose-500 font-bold">{t('menteeNotFound')}</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors">
        <ChevronLeft className="w-4 h-4" /> {t('backToDashboard')}
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{mentee.name}</h1>
            <p className="text-muted-foreground">{mentee.email}</p>
            {mentee.department && <span className="inline-block mt-2 bg-muted text-foreground text-xs font-bold px-2 py-1 rounded-md">{t('departmentLabel')} {mentee.department}</span>}
          </div>
        </div>
        <div>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
            {TIME_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button onClick={() => setActiveTab("history")} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "history" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> {t('evaluationHistoryTab')}</div>
        </button>
        <button onClick={() => setActiveTab("evaluate")} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "evaluate" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <div className="flex items-center gap-2"><ClipboardList className="w-4 h-4" /> {t('evaluateByJiraTab')}</div>
        </button>
        <button onClick={() => setActiveTab("badge")} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "badge" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <div className="flex items-center gap-2"><span className="text-base leading-none">🏆</span> {t('awardBadgeTab')}</div>
        </button>
        <button onClick={() => setActiveTab("note")} className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "note" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
          <div className="flex items-center gap-2"><span className="text-base leading-none">📝</span> {t('quickNoteTab')}</div>
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "history" && (
          <div className="space-y-6">
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
                    <div key={b.id} className="bg-card border border-amber-500/30 p-3 rounded-2xl flex items-center gap-3 shadow-sm">
                      <div className="bg-amber-500/10 p-2 rounded-full">
                        <span className="text-xl">⭐</span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground capitalize">{b.badge_type.replace('_', ' ')}</p>
                        <p className="text-[10px] font-bold text-amber-500 uppercase">
                          {b.awarded_by?.name ? `${t('awardedBy')} ${b.awarded_by.name}` : t('autoAwarded')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Charts Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-foreground mb-4">{t('performanceRadar')}</h3>
                <div className="h-48">
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
                <div className="h-48">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-border bg-muted/30 font-bold text-foreground">{t('jiraEvaluations')}</div>
                  {evaluations.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">{t('noEvaluationsYet')}</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {evaluations.map(ev => (
                        <div key={ev.id} className="p-6 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-xl"><FileText className="w-5 h-5 text-primary" /></div>
                              <div>
                                <p className="font-bold text-foreground">
                                  {ev.evaluation_type === 'sprint' ? `${t('sprint')}: ${ev.reference_id}` : `${t('ticket')}: ${ev.reference_id}`}
                                </p>
                                <p className="text-xs text-muted-foreground">{t('evaluatedBy')} {ev.evaluator?.name} · {new Date(ev.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <button onClick={() => handleDeleteEval(ev.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {(ev.metrics ?? []).map((m, i) => (
                              <div key={i} className="bg-muted/30 border border-border rounded-xl p-3 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-semibold text-foreground">{m.sla_rule?.name}</span>
                                  {metricBadge(m.sla_rule?.metric_type)}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{t('targetLabel')} <span className="font-mono text-foreground">{m.sla_rule?.target_value}</span></span>
                                  {m.value_numeric !== null && <span>· {t('scoreLabel')} <span className="font-bold text-foreground">{m.value_numeric}</span></span>}
                                  {m.value_string && <span>· <span className={m.value_string === 'Pass' ? 'text-emerald-500 font-bold' : m.value_string === 'Fail' ? 'text-rose-500 font-bold' : ''}>{m.value_string === 'Pass' ? t('pass') : m.value_string === 'Fail' ? t('fail') : m.value_string === 'N/A' ? t('notApplicable') : m.value_string}</span></span>}
                                </div>
                                {m.comment && <p className="text-xs text-muted-foreground italic">&quot;{m.comment}&quot;</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">{t('mentorsFeedback')}</h3>
                </div>
                {notes.length === 0 ? (
                  <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
                    {t('noQuickNotesYet')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map(n => (
                      <div key={n.id} className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{n.note_type === 'positive' ? '🟢' : n.note_type === 'constructive' ? '🟡' : '⚪'}</span>
                            <span className="font-bold text-sm text-foreground">{n.author?.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm text-foreground">{n.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "evaluate" && (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            {evalSuccess ? (
              <div className="p-12 text-center flex flex-col items-center gap-3">
                <CheckCircle className="w-16 h-16 text-emerald-500" />
                <p className="text-xl font-bold text-foreground">{t('evaluationSubmitted')}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitEval}>
                <div className="p-6 border-b border-border bg-muted/30 space-y-4">
                  <div className="flex gap-4">
                    <button type="button" onClick={() => setEvaluationType("ticket")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${evaluationType === "ticket" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {t('evaluateTicketBtn')}
                    </button>
                    <button type="button" onClick={() => setEvaluationType("sprint")} className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${evaluationType === "sprint" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                      {t('evaluateSprintBtn')}
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground mb-1">
                      {evaluationType === "ticket" ? t('jiraTicketIdLabel') : t('sprintNameLabel')}
                    </label>
                    <input type="text" required value={referenceId} onChange={e => setReferenceId(e.target.value)} placeholder={evaluationType === "ticket" ? t('egProj1234') : t('egSprint45')} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {visibleRules.map((rule) => {
                    const idx = metricInputs.findIndex(m => m.sla_rule_id === rule.id);
                    const inputState = metricInputs[idx];
                    if (!inputState) return null;
                    return (
                      <div key={rule.id} className={`p-4 border rounded-xl space-y-3 transition-colors ${inputState.is_enabled ? 'border-border bg-background' : 'border-dashed border-border bg-muted/30 opacity-50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={inputState.is_enabled} onChange={e => { const newInputs = [...metricInputs]; newInputs[idx].is_enabled = e.target.checked; setMetricInputs(newInputs); }} className="w-4 h-4 rounded border-border" />
                            <div>
                              <p className="font-bold text-sm text-foreground">{rule.name}</p>
                              <p className="text-xs text-muted-foreground">{t('targetLabel')} {rule.target_value}</p>
                            </div>
                          </div>
                          {metricBadge(rule.metric_type)}
                        </div>
                        {inputState.is_enabled && (
                          <div className="grid grid-cols-3 gap-3 ml-7">
                            <input type="number" placeholder={t('scoreOptional')} value={inputState.value_numeric} onChange={e => { const newInputs = [...metricInputs]; newInputs[idx].value_numeric = e.target.value; setMetricInputs(newInputs); }} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                            <select value={inputState.value_string} onChange={e => { const newInputs = [...metricInputs]; newInputs[idx].value_string = e.target.value; setMetricInputs(newInputs); }} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                              <option value="Pass">{t('pass')}</option>
                              <option value="Fail">{t('fail')}</option>
                              <option value="N/A">{t('notApplicable')}</option>
                            </select>
                            <input type="text" placeholder={t('comment')} value={inputState.comment} onChange={e => { const newInputs = [...metricInputs]; newInputs[idx].comment = e.target.value; setMetricInputs(newInputs); }} className="bg-muted border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="p-6 border-t border-border bg-muted/30 flex justify-end">
                  <button type="submit" disabled={isSubmitting} className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{t('submitEvaluation')}</button>
                </div>
              </form>
            )}
          </div>
        )}

        {activeTab === "badge" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
              <h4 className="text-lg font-bold text-foreground flex items-center gap-2"><span className="text-2xl">🏆</span> {t('awardBadgeTitle')}</h4>
              <div className="flex gap-3">
                <select value={selectedBadge} onChange={e => setSelectedBadge(e.target.value)} className="w-full max-w-md bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20">
                  <option value="">{t('selectBadgeOption')}</option>
                  <option value="zero_defect">{t('badgeOptZero')}</option>
                  <option value="one_shot">{t('badgeOptOneShot')}</option>
                  <option value="mastermind">{t('badgeOptMaster')}</option>
                  <option value="qa_friend">{t('badgeOptQA')}</option>
                  <option value="firefighter">{t('badgeOptFire')}</option>
                  <option value="sprint_master">{t('badgeOptSprint')}</option>
                  <option value="eagle_eye">{t('badgeOptEagle')}</option>
                  <option value="knowledge_keeper">{t('badgeOptKnowledge')}</option>
                  <option value="mvp">{t('badgeOptMVP')}</option>
                </select>
                <button onClick={handleAwardBadge} disabled={!selectedBadge} className="px-5 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50">{t('awardBadgeBtn')}</button>
              </div>
              {selectedBadge && (
                <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-700">
                  {t(`badge_${selectedBadge}` as DictionaryKey)}
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {badges.map(b => (
                <div key={b.id} className="bg-card border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-500/10 p-2 rounded-full"><Medal className="w-6 h-6 text-amber-500" /></div>
                    <div>
                      <p className="text-sm font-bold text-foreground capitalize">{b.badge_type.replace('_', ' ')}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {b.awarded_by?.name ? `${t('awardedBy')} ${b.awarded_by.name}` : t('autoAwarded')} {t('onDate')} {new Date(b.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteBadge(b.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "note" && (
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
              <h4 className="text-lg font-bold text-foreground flex items-center gap-2"><span className="text-2xl">📝</span> {editingNoteId ? t('editNoteTitle') : t('addNoteTitle')}</h4>
              <div className="grid grid-cols-1 gap-4 max-w-2xl">
                <select value={noteType} onChange={e => setNoteType(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20">
                  <option value="positive">{t('notePos')}</option>
                  <option value="neutral">{t('noteNeu')}</option>
                  <option value="constructive">{t('noteCon')}</option>
                </select>
                <textarea rows={4} value={noteMessage} onChange={e => setNoteMessage(e.target.value)} placeholder={t('messagePlaceholder')} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 resize-none"></textarea>
                <div className="flex gap-2">
                  <button onClick={handleSaveNote} disabled={!noteMessage.trim()} className="px-5 py-2.5 bg-secondary text-secondary-foreground font-bold text-sm rounded-xl hover:bg-muted transition-colors disabled:opacity-50">
                    {editingNoteId ? t('updateNote') : t('addNoteBtn')}
                  </button>
                  {editingNoteId && <button onClick={() => { setEditingNoteId(""); setNoteMessage(""); }} className="px-5 py-2.5 text-muted-foreground font-bold text-sm hover:text-foreground">{t('cancelBtn')}</button>}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {notes.length > 0 && (
                <div className="flex gap-4 text-xs font-semibold text-muted-foreground bg-muted/30 p-2 rounded-lg inline-flex">
                  <span>{t('labelPos')}</span>
                  <span>{t('labelNeu')}</span>
                  <span>{t('labelCon')}</span>
                </div>
              )}
              {notes.map(n => (
                <div key={n.id} className="bg-card border border-border p-4 rounded-2xl shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{n.note_type === 'positive' ? '🟢' : n.note_type === 'constructive' ? '🟡' : '⚪'}</span>
                      <span className="font-bold text-sm text-foreground">{n.author?.name}</span>
                      <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditNote(n)} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteNote(n.id)} className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-foreground ml-7 whitespace-pre-wrap">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Confirm Modal */}
      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.action}
        onCancel={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
      />
    </div>
  );
}
