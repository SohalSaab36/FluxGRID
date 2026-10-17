import React from 'react';
import { AlertTriangle, CarFront, Clock3, Construction, MapPin, TrafficCone } from 'lucide-react';
import { TrafficReport, TrafficReportType } from '../../types/traffic';

interface TrafficReportsPanelProps {
  reports: TrafficReport[];
  reportTtlSeconds: number;
  onSelectIntersection: (intersectionId: string) => void;
}

const reportLabels: Record<TrafficReportType, string> = {
  congestion: 'Heavy traffic',
  accident: 'Accident',
  roadwork: 'Roadwork',
  hazard: 'Road hazard',
  closure: 'Road closure',
};

const reportIcons: Record<TrafficReportType, React.ComponentType<{ className?: string }>> = {
  congestion: CarFront,
  accident: AlertTriangle,
  roadwork: Construction,
  hazard: TrafficCone,
  closure: MapPin,
};

function formatAge(createdAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} hr ago`;
}

export const TrafficReportsPanel: React.FC<TrafficReportsPanelProps> = ({
  reports,
  reportTtlSeconds,
  onSelectIntersection,
}) => (
  <section className="bg-bg-panel border border-border rounded-xl p-4">
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Community traffic reports</h2>
        <p className="text-[11px] text-text-muted mt-0.5">
          Pending accidents are visible until admin review · Reports expire after {reportTtlSeconds / 3600} hours
        </p>
      </div>
      <span className="px-2 py-1 rounded-full bg-[#0E1726] border border-border text-xs font-mono text-cyan">
        {reports.length} active
      </span>
    </div>

    {reports.length === 0 ? (
      <div className="rounded-lg bg-[#0E1726] border border-border/70 px-3 py-4 text-center">
        <MapPin className="w-4 h-4 text-text-muted mx-auto mb-1" />
        <p className="text-xs text-text-secondary">No active reports in this traffic network.</p>
        <p className="text-[10px] text-text-muted mt-1">Be the first to report a delay or road incident.</p>
      </div>
    ) : (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {reports.map((report) => {
          const Icon = reportIcons[report.type];
          return (
            <button
              key={report.id}
              onClick={() => onSelectIntersection(report.intersectionId)}
              className="w-full rounded-lg bg-[#0E1726] border border-border/70 hover:border-cyan/40 px-3 py-2.5 text-left transition-colors"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-7 h-7 rounded-md bg-warning-dark/70 border border-warning/20 text-warning flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-text-primary">{reportLabels[report.type]}</span>
                    <span className="flex items-center gap-2">
                      {report.approvalStatus === 'pending' && (
                        <span className="rounded border border-warning/30 bg-warning-dark/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
                          Pending
                        </span>
                      )}
                      <span className="text-[10px] text-text-muted shrink-0 flex items-center gap-1">
                        <Clock3 className="w-3 h-3" />
                        {formatAge(report.createdAt)}
                      </span>
                    </span>
                  </span>
                  <span className="block text-[11px] text-text-secondary truncate mt-0.5">
                    {report.description || reportLabels[report.type]}
                  </span>
                  <span className="block text-[10px] text-cyan mt-1">
                    {report.intersectionCode} · {report.intersectionName}
                    {report.distanceKm > 0.05 ? ` · ${report.distanceKm.toFixed(1)} km away` : ''}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    )}
  </section>
);
