import React, { useState } from 'react';
import { Sliders, ChevronDown, Sparkles, ShieldCheck, Play, Check } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';

export const SignalControlPanel: React.FC = () => {
  const {
    intersections,
    selectedIntersection,
    selectIntersection,
    applyAiToIntersection,
    toggleControllerMode,
  } = useTraffic();

  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [appliedFeedback, setAppliedFeedback] = useState<boolean>(false);

  const handleApply = () => {
    applyAiToIntersection(selectedIntersection.id);
    setAppliedFeedback(true);
    setTimeout(() => {
      setAppliedFeedback(false);
    }, 1800);
  };

  const getPhaseDot = (type: string) => {
    if (type === 'ns-green') return 'bg-success';
    if (type === 'ew-green') return 'bg-warning';
    return 'bg-text-muted';
  };

  return (
    <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col justify-between gap-3 select-none">
      {/* Top Header Row (matches screenshot) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan" />
          <span className="text-sm font-semibold text-text-primary">
            Adaptive signal control
          </span>
        </div>

        {/* AI RECOMMENDED badge */}
        <div className="px-2.5 py-0.5 rounded-full bg-cyan-dark/80 border border-cyan/30 text-cyan text-[10px] font-semibold tracking-wider">
          AI RECOMMENDED
        </div>
      </div>

      {/* Intersection Selector & Active Status Row */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 text-xs font-semibold text-text-primary hover:text-cyan transition-colors"
          >
            <span>{selectedIntersection.code} · {selectedIntersection.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
            <span
              className={`px-1.5 py-0.2 rounded text-[10px] font-medium border ${
                selectedIntersection.congestion === 'heavy'
                  ? 'bg-danger-dark text-danger border-danger/30'
                  : selectedIntersection.congestion === 'moderate'
                  ? 'bg-warning-dark text-warning border-warning/30'
                  : 'bg-success-dark text-success border-success/30'
              }`}
            >
              <span className="capitalize">{selectedIntersection.congestion}</span>
            </span>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 max-h-56 overflow-y-auto rounded-lg bg-[#111C2B] border border-border shadow-2xl py-1 z-30 text-xs">
              {intersections.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    selectIntersection(item.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#152538] text-left text-text-primary"
                >
                  <span>{item.code} · {item.name}</span>
                  <span className="capitalize text-[10px] text-text-muted">{item.congestion}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current phase and remaining countdown indicator */}
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
          <span>
            {selectedIntersection.currentPhase.includes('North-South') ? 'N-S green' : 'E-W green'} ·{' '}
            {selectedIntersection.phaseRemainingSeconds} s left
          </span>
        </div>
      </div>

      {/* Phasing Comparison Table (matches screenshot exactly) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/50 text-[10px] font-semibold text-text-muted tracking-wider uppercase">
              <th className="pb-2 font-medium">SIGNAL PHASE</th>
              <th className="pb-2 font-medium text-center">FIXED</th>
              <th className="pb-2 font-medium text-center">AI TIMING</th>
              <th className="pb-2 font-medium text-right">CHANGE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {selectedIntersection.phases.map((phase) => (
              <tr key={phase.id} className="hover:bg-[#142233]/40 transition-colors">
                <td className="py-2 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${getPhaseDot(phase.type)}`} />
                  <span className="text-text-primary text-xs">{phase.name}</span>
                </td>
                <td className="py-2 text-center text-text-secondary font-mono">
                  {phase.fixedDuration} s
                </td>
                <td className="py-2 text-center font-mono font-semibold text-cyan">
                  {phase.aiDuration} s
                </td>
                <td className="py-2 text-right font-mono text-[11px]">
                  {phase.changeSeconds > 0 ? (
                    <span className="text-success font-semibold">+{phase.changeSeconds} s</span>
                  ) : phase.changeSeconds < 0 ? (
                    <span className="text-warning font-semibold">{phase.changeSeconds} s</span>
                  ) : (
                    <span className="text-text-muted">No change</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* AI Recommendation Callout Card (matches screenshot) */}
      <div className="p-2.5 rounded-lg bg-[#0D2434] border border-cyan/25 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
        <div className="flex flex-col text-xs leading-tight">
          <span className="font-semibold text-cyan">
            {selectedIntersection.aiRecommendation}
          </span>
          <span className="text-[11px] text-text-secondary mt-0.5">
            {selectedIntersection.aiRecommendationReason}
          </span>
        </div>
      </div>

      {/* Footer Row: Safety constraints & Apply button */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1.5 text-xs text-success">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Safety constraints passed</span>
        </div>

        <button
          onClick={handleApply}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-md ${
            appliedFeedback
              ? 'bg-success text-black'
              : 'bg-cyan hover:bg-cyan-hover text-[#080F1B] active:scale-95'
          }`}
        >
          {appliedFeedback ? (
            <>
              <Check className="w-3.5 h-3.5" />
              <span>Applied to Simulation</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Apply to simulation</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
