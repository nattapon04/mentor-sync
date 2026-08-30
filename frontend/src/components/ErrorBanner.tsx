import { AlertCircle, X } from "lucide-react";

interface ErrorBannerProps {
  message: string | null;
  onDismiss?: () => void;
}

// A consistent, visible way to surface a failed request — used in place of the
// catch(err) { console.error(err) } silent no-op that used to leave the page looking fine
// while data quietly failed to load or save.
export function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl px-4 py-3 text-sm font-semibold">
      <span className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {message}
      </span>
      {onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="text-rose-600/70 hover:text-rose-600 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
