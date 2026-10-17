import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, Clock3, RefreshCw, X } from 'lucide-react';
import { api } from '../lib/apiClient';
import { TrafficReport } from '../types/traffic';
import { useTraffic } from '../context/TrafficContext';

export const AdminReports: React.FC = () => {
  const { currentUser, backendConnected, decideAccidentReport } = useTraffic();
  const [reports, setReports] = useState<TrafficReport[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyDecision, setBusyDecision] = useState<'approve' | 'reject' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPending = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await api.pendingAccidentReports();
      setReports(result.reports);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load pending reports.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin' && backendConnected) void loadPending();
  }, [backendConnected, currentUser?.role, loadPending]);

  const decide = async (reportId: string, decision: 'approve' | 'reject') => {
    setBusyId(reportId);
    setBusyDecision(decision);
    setError('');
    try {
      await decideAccidentReport(reportId, decision);
      await loadPending();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not update the report.');
    } finally {
      setBusyId(null);
      setBusyDecision(null);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex-1 p-5">
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger-dark/40 p-4 text-sm text-danger">
          Admin access is required to review accident reports.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-5">
      <section aria-labelledby="admin-reports-title" className="mx-auto max-w-4xl rounded-xl border border-border bg-bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 id="admin-reports-title" className="text-lg font-bold text-text-primary">Accident report approvals</h1>
            <p className="mt-1 text-xs text-text-secondary">Pending reports are visible to users with a Pending label. Approve to confirm, or reject to remove.</p>
          </div>
          <div className="flex items-center gap-2">
            <span aria-live="polite" className="rounded-full border border-warning/30 bg-warning-dark/40 px-2.5 py-1 text-xs font-semibold text-warning">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'} pending
            </span>
            <button
              type="button"
              onClick={() => void loadPending()}
              disabled={!backendConnected || isLoading || busyId !== null}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-secondary hover:border-cyan/40 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw aria-hidden="true" className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-lg border border-danger/30 bg-danger-dark/40 px-3 py-2 text-sm text-danger">{error}</p>}
        {!backendConnected ? (
          <p role="status" className="mt-5 text-sm text-text-secondary">The Python API is unavailable. Connect it to review accident reports.</p>
        ) : isLoading ? (
          <p role="status" aria-live="polite" className="mt-5 rounded-lg border border-border bg-[#0E1726] px-4 py-8 text-center text-sm text-text-secondary">
            Loading pending accident reports…
          </p>
        ) : reports.length === 0 ? (
          <div className="mt-5 rounded-lg border border-border bg-[#0E1726] px-4 py-8 text-center text-sm text-text-secondary">
            No accident reports are waiting for review.
          </div>
        ) : (
          <div className="mt-5 space-y-3" aria-busy={busyId !== null}>
            {reports.map((report) => (
              <article key={report.id} aria-labelledby={`report-${report.id}-title`} className="rounded-lg border border-border bg-[#0E1726] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning-dark/40 text-warning">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 id={`report-${report.id}-title`} className="text-sm font-semibold text-text-primary">{report.intersectionCode} · {report.intersectionName}</h2>
                      <p className="mt-1 text-xs text-text-secondary">{report.description || 'No additional details provided.'}</p>
                      <p className="mt-2 flex items-center gap-1 text-[10px] text-text-muted">
                        <Clock3 aria-hidden="true" className="h-3 w-3" />
                        Submitted {new Date(report.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void decide(report.id, 'approve')}
                      type="button"
                      disabled={busyId !== null}
                      aria-label={`${busyId === report.id && busyDecision === 'approve' ? 'Approving' : 'Approve'} report for ${report.intersectionName}`}
                      className="flex items-center gap-1.5 rounded-md bg-success-dark px-3 py-2 text-xs font-semibold text-success hover:brightness-110 disabled:opacity-50"
                    >
                      {busyId === report.id && busyDecision === 'approve' ? 'Approving…' : <><Check aria-hidden="true" className="h-3.5 w-3.5" /> Approve</>}
                    </button>
                    <button
                      onClick={() => void decide(report.id, 'reject')}
                      type="button"
                      disabled={busyId !== null}
                      aria-label={`${busyId === report.id && busyDecision === 'reject' ? 'Rejecting' : 'Reject'} report for ${report.intersectionName}`}
                      className="flex items-center gap-1.5 rounded-md border border-danger/30 px-3 py-2 text-xs font-semibold text-danger hover:bg-danger-dark/40 disabled:opacity-50"
                    >
                      {busyId === report.id && busyDecision === 'reject' ? 'Rejecting…' : <><X aria-hidden="true" className="h-3.5 w-3.5" /> Reject</>}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
