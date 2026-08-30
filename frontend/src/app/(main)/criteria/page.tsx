"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { Plus, Trash2, Globe, Building2, Edit2, X } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import api, { getErrorMessage } from "@/lib/api";
import { SLARule } from "@/types";

export default function SLACriteria() {
  const { t } = useLanguage();
  const { token } = useAuth();
  const [rules, setRules] = useState<SLARule[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New rule form state
  const [name, setName] = useState("");
  const [metricType, setMetricType] = useState("quality");
  const [evalType, setEvalType] = useState("both");
  const [targetValue, setTargetValue] = useState("");
  const [scope, setScope] = useState("global");
  const [isSaving, setIsSaving] = useState(false);

  // Edit rule modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<SLARule | null>(null);
  const [editName, setEditName] = useState("");
  const [editMetricType, setEditMetricType] = useState("quality");
  const [editEvalType, setEditEvalType] = useState("both");
  const [editTargetValue, setEditTargetValue] = useState("");
  const [editScope, setEditScope] = useState("global");
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchRules = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get("/sla-rules");
      setRules(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
    finally { setIsLoading(false); }
  };

  const fetchDepartments = async () => {
    try {
      const { data } = await api.get("/departments");
      setDepartments(Array.isArray(data) ? data : []);
    } catch (err) { setError(getErrorMessage(err, t('failedToLoadData'))); }
  };

  useEffect(() => {
    if (token) { fetchRules(); fetchDepartments(); }
  }, [token]);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.post("/sla-rules", { name, metric_type: metricType, eval_type: evalType, target_value: targetValue, scope });
      setName(""); setTargetValue(""); setScope("global"); setEvalType("both");
      setError(null);
      fetchRules();
    } catch (err) { setError(getErrorMessage(err, t('failedToSaveData'))); }
    finally { setIsSaving(false); }
  };

  const openEditModal = (rule: SLARule) => {
    setEditingRule(rule);
    setEditName(rule.name);
    setEditMetricType(rule.metric_type);
    setEditEvalType(rule.eval_type || "both");
    setEditTargetValue(rule.target_value);
    setEditScope(rule.scope || "global");
    setIsEditModalOpen(true);
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setIsUpdating(true);
    try {
      await api.put(`/sla-rules/${editingRule.id}`, { name: editName, metric_type: editMetricType, eval_type: editEvalType, target_value: editTargetValue, scope: editScope });
      setIsEditModalOpen(false);
      setError(null);
      fetchRules();
    } catch (err) { setError(getErrorMessage(err, t('failedToSaveData'))); }
    finally { setIsUpdating(false); }
  };

  const [confirmConfig, setConfirmConfig] = useState({ isOpen: false, title: "", message: "", action: () => {} });
  
  const handleDelete = (id: string) => {
    setConfirmConfig({
      isOpen: true,
      title: t('deleteSlaRuleTitle'),
      message: t('deleteSlaRuleMessage'),
      action: async () => {
        try {
          await api.delete(`/sla-rules/${id}`);
          fetchRules();
        } catch (err) { setError(getErrorMessage(err, t('failedToDeleteData'))); }
      }
    });
  };

  // Group rules by scope
  const groupedRules = useMemo(() => {
    const groups: Record<string, SLARule[]> = {};
    rules.forEach(r => {
      const key = r.scope || "global";
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    // Sort: global first, then alphabetically
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "global") return -1;
      if (b === "global") return 1;
      return a.localeCompare(b);
    });
  }, [rules]);

  const metricBadge = (type: string) => {
    if (type === "quality") return <span className="bg-emerald-500/10 text-emerald-600 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('quality')}</span>;
    if (type === "velocity") return <span className="bg-blue-500/10 text-blue-500 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('velocity')}</span>;
    return <span className="bg-purple-500/10 text-purple-500 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('softSkill')}</span>;
  };

  const evalTypeBadge = (type: string) => {
    if (type === "ticket") return <span className="bg-cyan-500/10 text-cyan-600 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('evalTypeTicket')}</span>;
    if (type === "sprint") return <span className="bg-orange-500/10 text-orange-500 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('evalTypeSprint')}</span>;
    return <span className="bg-slate-500/10 text-slate-500 text-[11px] font-bold uppercase px-2 py-0.5 rounded-md">{t('evalTypeBoth')}</span>;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('slaConfig')}</h1>
        <p className="text-muted-foreground">{t('manageGlobalSla')}</p>
      </div>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      {/* Add New Rule Form */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-primary" /> {t('addNewSlaRule')}
        </h2>
        <form onSubmit={handleAddRule}>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-1.5">{t('ruleName')}</label>
              <input required type="text" value={name} onChange={e => setName(e.target.value)} placeholder={t('egBugReopen')} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-1.5">{t('metricType')}</label>
              <select value={metricType} onChange={e => setMetricType(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                <option value="quality">{t('quality')}</option>
                <option value="velocity">{t('velocity')}</option>
                <option value="soft_skill">{t('softSkill')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-1.5">{t('appliesTo')}</label>
              <select value={evalType} onChange={e => setEvalType(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                <option value="ticket">{t('evalTypeTicket')}</option>
                <option value="sprint">{t('evalTypeSprint')}</option>
                <option value="both">{t('evalTypeBoth')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-1.5">{t('opTarget')}</label>
              <input required type="text" value={targetValue} onChange={e => setTargetValue(e.target.value)} placeholder={t('egTarget')} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground/80 mb-1.5">
                {t('departmentScope')}
              </label>
              <select value={scope} onChange={e => setScope(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                <option value="global">🌐 {t('globalAllTeams')}</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>🏢 {dept}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={isSaving} className="bg-primary text-primary-foreground px-5 py-2 rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50">
              {isSaving ? t('saving') : t('saveRule')}
            </button>
          </div>
        </form>
      </div>

      {/* Rules grouped by Department */}
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">{t('loading')}</div>
      ) : rules.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">{t('noSlaRules')}</div>
      ) : (
        groupedRules.map(([scopeKey, scopeRules]) => (
          <div key={scopeKey} className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Group Header */}
            <div className="px-6 py-4 border-b border-border flex items-center gap-3">
              {scopeKey === "global" ? (
                <Globe className="w-5 h-5 text-primary" />
              ) : (
                <Building2 className="w-5 h-5 text-amber-500" />
              )}
              <h2 className="text-base font-bold text-foreground">
                {scopeKey === "global" ? `🌐 ${t('globalAllTeamsTitle')}` : `🏢 ${scopeKey}`}
              </h2>
              <span className="ml-auto bg-muted text-muted-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                {scopeRules.length} {t('rulesCount')}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">{t('ruleNameColumn')}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t('typeColumn')}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t('appliesTo')}</th>
                  <th className="px-6 py-3 text-left font-semibold">{t('targetColumn')}</th>
                  <th className="px-6 py-3 text-right font-semibold">{t('actionsColumn')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {scopeRules.map(rule => (
                  <tr key={rule.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4 font-semibold text-foreground">{rule.name}</td>
                    <td className="px-6 py-4">{metricBadge(rule.metric_type)}</td>
                    <td className="px-6 py-4">{evalTypeBadge(rule.eval_type || "both")}</td>
                    <td className="px-6 py-4 font-mono text-foreground">{rule.target_value}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditModal(rule)} className="p-2 text-muted-foreground hover:text-primary transition-colors" title={t('editRuleTooltip')}>
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(rule.id)} className="p-2 text-muted-foreground hover:text-rose-500 transition-colors" title={t('deleteRuleTooltip')}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Edit Rule Modal */}
      {isEditModalOpen && editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-lg overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-foreground">{t('editSlaRuleTitle')}</h3>
                <p className="text-sm text-muted-foreground mt-0.5">{t('editSlaRuleDesc')}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateRule}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('ruleName')}</label>
                  <input required type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">{t('metricType')}</label>
                    <select value={editMetricType} onChange={e => setEditMetricType(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                      <option value="quality">{t('quality')}</option>
                      <option value="velocity">{t('velocity')}</option>
                      <option value="soft_skill">{t('softSkill')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-1.5">{t('appliesTo')}</label>
                    <select value={editEvalType} onChange={e => setEditEvalType(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                      <option value="ticket">{t('evalTypeTicket')}</option>
                      <option value="sprint">{t('evalTypeSprint')}</option>
                      <option value="both">{t('evalTypeBoth')}</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('opTarget')}</label>
                  <input required type="text" value={editTargetValue} onChange={e => setEditTargetValue(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">{t('departmentScope')}</label>
                  <select value={editScope} onChange={e => setEditScope(e.target.value)} className="w-full border border-border rounded-xl p-2.5 text-sm bg-background text-foreground focus:outline-none">
                    <option value="global">🌐 {t('globalAllTeams')}</option>
                    {departments.map(dept => (
                      <option key={dept} value={dept}>🏢 {dept}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="p-4 border-t border-border bg-muted/30 flex justify-end gap-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted">{t('cancelModal')}</button>
                <button type="submit" disabled={isUpdating} className="px-5 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {isUpdating ? t('updating') : t('updateRule')}
                </button>
              </div>
            </form>
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
