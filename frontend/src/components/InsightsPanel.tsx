"use client";

import { CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Evaluation, EarnedBadge, GeneralNote } from "@/types";
import { computeInsights, GrowthInfo } from "@/lib/insights";
import { DictionaryKey } from "@/locales/dictionary";

const GROWTH_STYLE: Record<GrowthInfo["direction"], { Icon: typeof TrendingUp; iconBg: string; color: string; key: DictionaryKey }> = {
  up: { Icon: TrendingUp, iconBg: "bg-emerald-500/10", color: "text-emerald-600 dark:text-emerald-400", key: "insightsGrowthUp" },
  down: { Icon: TrendingDown, iconBg: "bg-rose-500/10", color: "text-rose-600 dark:text-rose-400", key: "insightsGrowthDown" },
  flat: { Icon: Minus, iconBg: "bg-muted", color: "text-muted-foreground", key: "insightsGrowthFlat" },
};

function QuickNoteQuote({ message, date }: { message: string; date: string }) {
  const { t } = useLanguage();
  return (
    <blockquote className="mt-1.5 pl-2.5 border-l-2 border-border italic text-muted-foreground">
      &quot;{message}&quot;{" "}
      <span className="not-italic text-[11px]">— {t("quickNoteLabel")}, {new Date(date).toLocaleDateString()}</span>
    </blockquote>
  );
}

export function InsightsPanel({ evaluations, badges, notes }: { evaluations: Evaluation[]; badges: EarnedBadge[]; notes: GeneralNote[] }) {
  const { t } = useLanguage();
  const insights = computeInsights(evaluations, badges, notes);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-1">{t("menteeInsightsTitle")}</h3>
      <p className="text-xs text-muted-foreground mb-4">{t("menteeInsightsDesc")}</p>

      {!insights.hasEnoughData ? (
        <p className="text-sm text-muted-foreground">{t("insightsNoData")}</p>
      ) : (
        <div className="space-y-4">
          {(insights.bestRule || insights.latestBadge) && (
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm leading-snug flex-1 min-w-0">
                <span className="font-semibold text-foreground">{t("insightsGoingWellLabel")}</span>
                <ul className="mt-0.5 space-y-0.5 text-foreground/90">
                  {insights.bestRule && (
                    <li>
                      {t("insightsBestRuleText")
                        .replace("{rule}", insights.bestRule.ruleName)
                        .replace("{rate}", String(Math.round(insights.bestRule.passRate)))
                        .replace("{pass}", String(insights.bestRule.passCount))
                        .replace("{total}", String(insights.bestRule.totalCount))}
                    </li>
                  )}
                  {insights.latestBadge && (
                    <li>
                      {t("insightsLatestBadgeText")
                        .replace("{badge}", insights.latestBadge.badgeType.replace(/_/g, " "))
                        .replace("{date}", new Date(insights.latestBadge.date).toLocaleDateString())}
                    </li>
                  )}
                </ul>
                {insights.goingWellQuote && <QuickNoteQuote {...insights.goingWellQuote} />}
              </div>
            </div>
          )}

          {insights.topFocusArea && (
            <div className="flex items-start gap-2.5">
              <div className="shrink-0 w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
              <div className="text-sm leading-snug flex-1 min-w-0">
                <span className="font-semibold text-foreground">{t("insightsNeedsImprovementLabel")}</span>
                <p className="mt-0.5 text-foreground/90">
                  {insights.topFocusArea.name}:{" "}
                  {t("failedXofY")
                    .replace("{failed}", String(insights.topFocusArea.failCount))
                    .replace("{total}", String(insights.topFocusArea.passCount + insights.topFocusArea.failCount))}
                </p>
                {insights.needsImprovementQuote && <QuickNoteQuote {...insights.needsImprovementQuote} />}
              </div>
            </div>
          )}

          {insights.growth && (() => {
            const gs = GROWTH_STYLE[insights.growth.direction];
            return (
              <div className="flex items-start gap-2.5">
                <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${gs.iconBg} ${gs.color}`}>
                  <gs.Icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-sm leading-snug flex-1 min-w-0">
                  <span className="font-semibold text-foreground">{t("insightsGrowthLabel")}</span>
                  <p className={`mt-0.5 font-medium ${gs.color}`}>
                    {t(gs.key)
                      .replace("{delta}", String(Math.abs(Math.round(insights.growth.deltaPoints))))
                      .replace("{before}", String(Math.round(insights.growth.beforeRate)))
                      .replace("{after}", String(Math.round(insights.growth.afterRate)))}
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
