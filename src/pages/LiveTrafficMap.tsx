import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Sliders, Radio, Layers, ShieldCheck, Activity, MessageSquarePlus } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { MapLibreView } from '../components/map/MapLibreView';
import { SchematicMapView } from '../components/map/SchematicMapView';
import { TrafficReportsPanel } from '../components/dashboard/TrafficReportsPanel';
import { TrafficReportDialog } from '../components/dashboard/TrafficReportDialog';
import { TrafficReport } from '../types/traffic';
import { RoutePlannerPanel } from '../components/dashboard/RoutePlannerPanel';
import { RoutePlan } from '../lib/apiClient';

export const LiveTrafficMap: React.FC = () => {
  const {
    intersections,
    selectedIntersection,
    selectIntersection,
    mapViewMode,
    setMapViewMode,
    applyAiToIntersection,
    trafficReports,
    reportTtlSeconds,
    reportMaxDistanceKm,
    backendConnected,
    submitTrafficReport,
    currentUser,
    setCurrentView,
  } = useTraffic();

  const [filterCongestion, setFilterCongestion] = useState<'all' | 'heavy' | 'moderate' | 'clear'>('all');
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');
  const [routePlan, setRoutePlan] = useState<RoutePlan | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  const filteredIntersections = useMemo(
    () => intersections.filter((item) => (
      filterCongestion === 'all' || item.congestion === filterCongestion
    )),
    [filterCongestion, intersections],
  );
  const filteredIntersectionIds = useMemo(
    () => filteredIntersections.map((item) => item.id),
    [filteredIntersections],
  );

  useEffect(() => {
    if (
      filteredIntersectionIds.length > 0
      && !filteredIntersectionIds.includes(selectedIntersection.id)
    ) {
      selectIntersection(filteredIntersectionIds[0]);
    }
  }, [filteredIntersectionIds, selectIntersection, selectedIntersection.id]);

  const handleReportSubmitted = (report: TrafficReport) => {
    setReportSuccess(`Report added near ${report.intersectionCode} · ${report.intersectionName}`);
    setReportDialogOpen(false);
  };

  const handleRoutePlanChange = (plan: RoutePlan | null, routeId: string | null) => {
    setRoutePlan(plan);
    setSelectedRouteId(routeId);
    if (plan) setMapViewMode('maplibre');
  };

  return (
    <div className="min-h-0 flex-1 flex flex-col p-5 gap-4 overflow-y-auto" style={{ overflowAnchor: 'none' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Live Traffic Map & Spatial Telemetry
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time corridor mapping across 12 connected intersections (Delhi NCR Demo Coordinates)
          </p>
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setReportSuccess('');
              setReportDialogOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan text-[#080F1B] text-xs font-semibold hover:bg-cyan-hover transition-colors"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            Report traffic
          </button>
          <button
            onClick={() => setMapViewMode('schematic')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              mapViewMode === 'schematic'
                ? 'bg-cyan/15 border-cyan text-cyan'
                : 'bg-[#142233] border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Digital Twin Grid
          </button>
          <button
            onClick={() => setMapViewMode('maplibre')}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              mapViewMode === 'maplibre'
                ? 'bg-cyan/15 border-cyan text-cyan'
                : 'bg-[#142233] border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            Street map
          </button>
        </div>
      </div>

      <RoutePlannerPanel
        backendConnected={backendConnected}
        onPlanChange={handleRoutePlanChange}
      />

      {/* Main Grid: Left Map (8 cols) + Right Detail Drawer (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1">
        {/* Map Panel */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          {reportSuccess && (
            <p role="status" className="rounded-lg border border-success/30 bg-success-dark/40 px-3 py-2 text-xs text-success">
              {reportSuccess}
            </p>
          )}
          <div className="bg-bg-panel border border-border rounded-xl p-3 flex flex-col gap-3">
            {/* Filter pills */}
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-text-muted text-[11px]">Filter:</span>
                {(['all', 'heavy', 'moderate', 'clear'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setFilterCongestion(lvl)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize transition-colors ${
                      filterCongestion === lvl
                        ? 'bg-cyan-dark text-cyan border border-cyan/40 font-semibold'
                        : 'bg-[#0E1726] text-text-secondary hover:text-text-primary border border-border/60'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="text-text-muted text-[11px]">
                Showing {filteredIntersections.length} of {intersections.length} nodes
              </span>
            </div>

            {/* Map Container */}
            <div className="w-full h-[480px]">
              {mapViewMode === 'schematic'
                ? <SchematicMapView intersectionIds={filteredIntersectionIds} containerClassName="h-full" />
                : <MapLibreView
                    plannedRoute={routePlan}
                    selectedRouteId={selectedRouteId}
                    intersectionIds={filteredIntersectionIds}
                    containerClassName="h-full"
                  />}
            </div>
          </div>
          <TrafficReportsPanel
            reports={trafficReports}
            reportTtlSeconds={reportTtlSeconds}
            onSelectIntersection={selectIntersection}
          />
        </div>

        {/* Right Intersection Detail Card */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div>
                <span className="text-xs font-mono text-cyan">{selectedIntersection.code}</span>
                <h3 className="text-base font-bold text-text-primary">{selectedIntersection.name}</h3>
                <span className="text-[11px] text-text-muted">{selectedIntersection.district}</span>
              </div>
              <span
                className={`px-2 py-1 rounded-full text-xs font-semibold capitalize border ${
                  selectedIntersection.congestion === 'heavy'
                    ? 'bg-danger-dark text-danger border-danger/40'
                    : selectedIntersection.congestion === 'moderate'
                    ? 'bg-warning-dark text-warning border-warning/40'
                    : 'bg-success-dark text-success border-success/40'
                }`}
              >
                {selectedIntersection.congestion}
              </span>
            </div>

            {/* Active Signal State */}
            <div className="rounded-lg bg-[#0E1726] border border-border p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
                <div>
                  <div className="text-xs font-semibold text-text-primary">
                    {selectedIntersection.currentPhase}
                  </div>
                  <div className="text-[10px] text-text-muted">
                    Total Cycle: {selectedIntersection.cycleLengthSeconds} s
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-mono font-bold text-cyan">
                  {selectedIntersection.phaseRemainingSeconds} s
                </span>
                <div className="text-[10px] text-text-muted">Remaining</div>
              </div>
            </div>

            {/* Approach Queue Breakdown */}
            <div>
              <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                Approach Queue & Flow
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {Object.entries(selectedIntersection.approaches).map(([dirKey, app]) => (
                  <div key={dirKey} className="rounded-md bg-[#0E1726] border border-border/70 p-2 flex flex-col">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-primary">{app.direction}</span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          app.currentSignal === 'green'
                            ? 'bg-success'
                            : app.currentSignal === 'amber'
                            ? 'bg-warning'
                            : 'bg-danger'
                        }`}
                      />
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-bold text-text-primary font-mono">
                        {app.vehiclesInQueue} <span className="text-[10px] font-normal text-text-muted">veh</span>
                      </span>
                      <span className="text-[10px] text-text-muted font-mono">{app.averageWaitSeconds}s avg</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendation */}
            <div className="rounded-lg bg-cyan-dark/40 border border-cyan/30 p-2.5 text-xs">
              <span className="font-semibold text-cyan">AI Optimization</span>
              <p className="text-[11px] text-text-secondary mt-0.5">
                {selectedIntersection.aiRecommendation}
              </p>
            </div>

            {/* Action Button */}
            <button
              onClick={() => applyAiToIntersection(selectedIntersection.id)}
              className="w-full py-2 rounded-lg bg-cyan hover:bg-cyan-hover text-[#080F1B] font-semibold text-xs transition-colors shadow-md active:scale-95"
            >
              Apply AI Optimization to Node
            </button>
          </div>
        </div>
      </div>
      {reportDialogOpen && (
        <TrafficReportDialog
          backendConnected={backendConnected}
          currentUser={currentUser}
          reportTtlSeconds={reportTtlSeconds}
          reportMaxDistanceKm={reportMaxDistanceKm}
          onClose={() => setReportDialogOpen(false)}
          onSubmit={submitTrafficReport}
          onSubmitted={handleReportSubmitted}
          onSignIn={() => {
            setReportDialogOpen(false);
            setCurrentView('account');
          }}
        />
      )}
    </div>
  );
};
