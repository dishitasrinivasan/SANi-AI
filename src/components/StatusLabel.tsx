import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

interface StatusLabelProps {
  tone: 'nominal' | 'warning' | 'critical' | 'info';
  label: string;
}

export function StatusLabel({ tone, label }: StatusLabelProps) {
  if (tone === 'critical') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (tone === 'warning') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  if (tone === 'info') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded whitespace-nowrap shrink-0">
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}
