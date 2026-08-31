"use client";

import Link from "next/link";
import { CheckCircle, AlertTriangle, XCircle, ChevronRight, UserPlus, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { User, Evaluation } from "@/types";
import { TIME_RANGE_OPTIONS, TimeRange, PASS_RATE_THRESHOLDS, getStartDateParam } from "@/lib/constants";

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, token } = useAuth();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>("30");
  const [error, setError] = useState<string | null>(null);

  // Add Mentee modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedMenteeId, setSelectedMenteeId] = useState("");

  const fetchUsers = async () => {
    try {
      const { data } = await api.get("/users");
      setAllUsers(Array.isArray(data) ? data : []);
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
  };

  const fetchEvaluations = async () => {
    try {
      const params: Record<string, string> = {};
      const startDate = getStartDateParam(timeRange);
      if (startDate) params.start_date = startDate;
      const { data } = await api.get("/evaluations", { params });
      setEvaluations(Array.isArray(data) ? data : []);
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
  };

  useEffect(() => {
    if (token) { fetchUsers(); fetchEvaluations(); }
  }, [token, timeRange]);

  const handleAssign = async () => {
    if (!selectedMenteeId || !user) return;
    try {
      await api.post(`/users/${user.id}/assign-mentee`, { mentee_id: selectedMenteeId });
      setIsAddModalOpen(false);
      setSelectedMenteeId("");
      fetchUsers();
    } catch (err) { setError(getErrorMessage(err, t('failedToSaveData'))); }
  };

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", action: () => {} });

  const handleUnassign = (menteeId: string) => {
    if (!user) return;
    setConfirmConfig({
      isOpen: true,
      title: t('removeMenteeTitle'),
      message: t('removeMenteeConfirmMessage'),
      action: async () => {
        try {
          await api.post(`/users/${user.id}/unassign-mentee`, { mentee_id: menteeId });
          fetchUsers();
        } catch (err) { setError(getErrorMessage(err, t('failedToDeleteData'))); }
      }
    });
  };

  const myMentees = allUsers.filter(u => u.manager_id === user?.id);
  const availableMentees = allUsers.filter(u => u.roles?.includes("mentee") && !u.manager_id && u.id !== user?.id);

  const getMenteeStatus = (menteeId: string) => {
    const menteeEvals = evaluations.filter(ev => ev.mentee?.id === menteeId);
    if (menteeEvals.length === 0) return "onTrack";

    let passCount = 0;
    let totalCount = 0;
    menteeEvals.forEach(ev => {
      (ev.metrics || []).forEach((m) => {
        if (m.is_enabled && (m.value_string === 'Pass' || m.value_string === 'Fail')) {
          totalCount++;
          if (m.value_string === 'Pass') passCount++;
        }
      });
    });

    if (totalCount === 0) return "onTrack";
    const rate = passCount / totalCount;
    if (rate >= PASS_RATE_THRESHOLDS.onTrack) return "onTrack";
    if (rate >= PASS_RATE_THRESHOLDS.atRisk) return "atRisk";
    return "offTrack";
  };

  const statusCounts = {
    onTrack: myMentees.filter(m => getMenteeStatus(m.id) === "onTrack").length,
    atRisk: myMentees.filter(m => getMenteeStatus(m.id) === "atRisk").length,
    offTrack: myMentees.filter(m => getMenteeStatus(m.id) === "offTrack").length,
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('teamDashboard')}</h1>
        <div className="flex items-center gap-3">
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value as TimeRange)} className="bg-card border border-border rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20">
            {TIME_RANGE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>)}
          </select>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
            <UserPlus className="w-4 h-4" />{t('addMentee')}
          </button>
        </div>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-full"><CheckCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t('onTrack')}</p>
            <p className="text-2xl font-bold text-foreground">{statusCounts.onTrack}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-full"><AlertTriangle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t('atRisk')}</p>
            <p className="text-2xl font-bold text-foreground">{statusCounts.atRisk}</p>
          </div>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-500/10 text-rose-500 rounded-full"><XCircle className="w-6 h-6" /></div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">{t('offTrack')}</p>
            <p className="text-2xl font-bold text-foreground">{statusCounts.offTrack}</p>
          </div>
        </div>
      </div>

      {/* Mentees Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">{t('teamMembers')}</h2>
        </div>
        <div className="divide-y divide-border">
          {myMentees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p>{t('noMentees')}</p>
            </div>
          ) : (
            myMentees.map((mentee) => (
              <div key={mentee.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{mentee.name}</h3>
                    <p className="text-sm text-muted-foreground">{mentee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleUnassign(mentee.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 text-rose-500 text-xs font-bold rounded-lg hover:bg-rose-500/20 transition-colors">
                    {t('remove')} <X className="w-3.5 h-3.5" />
                  </button>
                  <Link href={`/mentees/${mentee.id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors">
                    {t('viewDetails')} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Mentee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-lg overflow-hidden">
            <div className="p-6">
              <h3 className="text-xl font-bold text-foreground">{t('addMentee')}</h3>
              <p className="text-sm text-muted-foreground mt-1">{t('addMenteeDesc')}</p>
              <div className="mt-6">
                <label className="block text-sm font-semibold text-foreground mb-1.5">{t('selectMenteeModal')}</label>
                <select value={selectedMenteeId} onChange={e => setSelectedMenteeId(e.target.value)} className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="" disabled>-- {t('selectMenteeModal')} --</option>
                  {availableMentees.map(m => <option key={m.id} value={m.id}>{m.name} ({t('unassigned')})</option>)}
                  {availableMentees.length === 0 && <option value="" disabled>{t('noUnassignedMentees')}</option>}
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted">{t('cancelModal')}</button>
              <button onClick={handleAssign} disabled={!selectedMenteeId} className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">{t('saveModal')}</button>
            </div>
          </div>
        </div>
      )}

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
