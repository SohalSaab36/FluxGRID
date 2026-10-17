import React from 'react';
import { Sliders, ShieldCheck, Check, RotateCcw } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';

export const IntersectionControl: React.FC = () => {
  const {
    intersections,
    selectedIntersection,
    selectIntersection,
    toggleControllerMode,
    applyAiToIntersection,
  } = useTraffic();

  return (
    <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Intersection Signal Matrix & Demand Control
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Configure signal phase splits, cycle lengths, and test dynamic queue demand rebalancing
          </p>
        </div>

        {/* Global mode batch buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => intersections.forEach((i) => toggleControllerMode(i.id, 'adaptive'))}
            className="px-3 py-1.5 rounded-lg bg-cyan-dark/80 border border-cyan/40 text-cyan text-xs font-semibold hover:bg-cyan/20 transition-colors"
          >
            Set All to Adaptive AI
          </button>
          <button
            onClick={() => intersections.forEach((i) => toggleControllerMode(i.id, 'fixed'))}
            className="px-3 py-1.5 rounded-lg bg-[#142233] border border-border text-text-secondary text-xs hover:text-text-primary transition-colors"
          >
            Set All to Fixed Timing
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Intersections List (5 cols) */}
        <div className="lg:col-span-5 bg-bg-panel border border-border rounded-xl p-3 flex flex-col gap-2 max-h-[640px] overflow-y-auto">
          <span className="text-xs font-semibold text-text-muted uppercase tracking-wider px-2 py-1">
            Connected Intersections ({intersections.length})
          </span>

          <div className="space-y-1.5">
            {intersections.map((item) => {
              const isSelected = item.id === selectedIntersection.id;
              return (
                <div
                  key={item.id}
                  onClick={() => selectIntersection(item.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#152538] border-cyan text-text-primary shadow-md'
                      : 'bg-[#0E1726] border-border/70 hover:border-border text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-cyan">{item.code}</span>
                      <span className="font-semibold text-xs text-text-primary">{item.name}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        item.congestion === 'heavy'
                          ? 'bg-danger-dark text-danger'
                          : item.congestion === 'moderate'
                          ? 'bg-warning-dark text-warning'
                          : 'bg-success-dark text-success'
                      }`}
                    >
                      {item.congestion}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                    <span>Queue: {item.queueLength} veh</span>
                    <span className="font-mono">
                      Phase: {item.currentPhase.includes('North-South') ? 'N-S' : 'E-W'} ({item.phaseRemainingSeconds}s)
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[9px] font-medium ${
                        item.controllerMode === 'adaptive'
                          ? 'bg-cyan-dark text-cyan border border-cyan/30'
                          : 'bg-[#1F2E45] text-text-secondary'
                      }`}
                    >
                      {item.controllerMode.toUpperCase()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Selected Intersection Deep Dive (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-4 shadow-lg">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div>
                <span className="text-xs font-mono text-cyan">{selectedIntersection.code}</span>
                <h2 className="text-lg font-bold text-text-primary">{selectedIntersection.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">Controller Mode:</span>
                <button
                  onClick={() => toggleControllerMode(selectedIntersection.id)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors border ${
                    selectedIntersection.controllerMode === 'adaptive'
                      ? 'bg-cyan-dark text-cyan border-cyan/40'
                      : 'bg-[#1F2E45] text-text-secondary border-border'
                  }`}
                >
                  {selectedIntersection.controllerMode === 'adaptive' ? 'Adaptive AI' : 'Fixed Timing'}
                </button>
              </div>
            </div>

            {/* Approach Queues & Live Flow */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Approach Queue Telemetry
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedIntersection.approaches).map(([key, app]) => (
                  <div key={key} className="p-3 rounded-lg bg-[#0E1726] border border-border flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-primary">{app.direction} Approach</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          app.currentSignal === 'green'
                            ? 'bg-success-dark text-success'
                            : app.currentSignal === 'amber'
                            ? 'bg-warning-dark text-warning'
                            : 'bg-danger-dark text-danger'
                        }`}
                      >
                        {app.currentSignal}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-text-muted">Queued Vehicles:</span>
                      <span className="font-mono font-bold text-text-primary text-sm">{app.vehiclesInQueue}</span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-text-muted">Flow Demand:</span>
                      <span className="font-mono text-text-secondary text-[11px]">{app.flowRateVehPerHour} veh/h</span>
                    </div>

                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-text-muted">Average Waiting:</span>
                      <span className="font-mono text-text-secondary text-[11px]">{app.averageWaitSeconds} s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Phasing Allocation Table */}
            <div>
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
                Phase Timing Comparison
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 text-[10px] text-text-muted uppercase tracking-wider text-left">
                    <th className="pb-2 font-medium">Phase</th>
                    <th className="pb-2 font-medium text-center">Fixed Baseline</th>
                    <th className="pb-2 font-medium text-center">AI Optimization</th>
                    <th className="pb-2 font-medium text-right">Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {selectedIntersection.phases.map((phase) => (
                    <tr key={phase.id} className="hover:bg-[#142233]/40">
                      <td className="py-2.5 font-medium text-text-primary">{phase.name}</td>
                      <td className="py-2.5 text-center font-mono text-text-secondary">{phase.fixedDuration} s</td>
                      <td className="py-2.5 text-center font-mono font-semibold text-cyan">{phase.aiDuration} s</td>
                      <td className="py-2.5 text-right font-mono text-[11px]">
                        {phase.changeSeconds > 0 ? (
                          <span className="text-success font-semibold">+{phase.changeSeconds} s</span>
                        ) : phase.changeSeconds < 0 ? (
                          <span className="text-warning font-semibold">{phase.changeSeconds} s</span>
                        ) : (
                          <span className="text-text-muted">0 s</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* AI Callout & Apply Button */}
            <div className="p-3 rounded-lg bg-cyan-dark/40 border border-cyan/30 flex items-start justify-between gap-3">
              <div>
                <span className="font-semibold text-cyan text-xs block">AI Strategy</span>
                <span className="text-xs text-text-secondary">{selectedIntersection.aiRecommendation}</span>
                <p className="text-[11px] text-text-muted mt-0.5">{selectedIntersection.aiRecommendationReason}</p>
              </div>
              <button
                onClick={() => applyAiToIntersection(selectedIntersection.id)}
                className="px-4 py-2 rounded-lg bg-cyan hover:bg-cyan-hover text-[#080F1B] font-semibold text-xs shrink-0 transition-colors shadow"
              >
                Apply to Simulation
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
