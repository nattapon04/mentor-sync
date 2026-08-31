"use client";

import { TrendingDown } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Evaluation } from "@/types";
import { computeFocusAreas } from "@/lib/focusAreas";

const metricBadgeClass = (type: string) => {
  if (type === "quality") return "bg-emerald-500/10 text-emerald-600";
  if (type === "velocity") return "bg-blue-500/10 text-blue-500";
  return "bg-purple-500/10 text-purple-500";
};

// Trims to at most 2 decimals without padding whole numbers with ".00".
const formatNumber = (n: number) => Math.round(n * 100) / 100;

export function FocusAreasPanel({ evaluations }: { evaluations: Evaluation[] }) {
  const { t } = useLanguage();
  const focusAreas = computeFocusAreas(evaluations);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
        <TrendingDown className="w-4 h-4 text-rose-500" /> {t('focusAreas')}
      </h3>
      <p className="text-xs text-muted-foreground mb-4">{t('focusAreasDesc')}</p>
      {focusAreas.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('noFocusAreas')}</p>
      ) : (
        <div className="space-y-3">
          {focusAreas.map(area => (
            <div key={area.slaRuleId} className="border border-border rounded-xl p-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{area.name}</span>
                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0 ${metricBadgeClass(area.metricType)}`}>
                  {area.metricType.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('targetLabel')} <span className="font-mono text-foreground">{area.targetValue}</span>
                {' · '}
                <span className="text-rose-500 font-bold">
                  {t('failedXofY').replace('{failed}', String(area.failCount)).replace('{total}', String(area.passCount + area.failCount))}
                </span>
              </div>
              {area.gap != null && area.avgActual != null && (() => {
                // gap is signed so that positive always means "needs improvement", but which
                // direction that is depends on the operator: for "<=" a positive gap means the
                // average is above the ceiling; for ">="/"=" it means the average is below target.
                const isOverTarget = area.targetOperator === "<=" ? area.gap >= 0 : area.gap < 0;
                return (
                  <p className="text-xs font-semibold text-amber-600">
                    {(isOverTarget ? t('gapOverTarget') : t('gapShortOfTarget'))
                      .replace('{actual}', String(formatNumber(area.avgActual!)))
                      .replace('{gap}', String(formatNumber(Math.abs(area.gap!))))}
                  </p>
                );
              })()}
              {area.lastComment && <p className="text-xs text-muted-foreground italic">&quot;{area.lastComment}&quot;</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
