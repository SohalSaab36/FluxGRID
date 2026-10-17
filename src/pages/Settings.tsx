import React from 'react';
import { Settings as SettingsIcon, Save, RotateCcw, ShieldCheck, Map, Bell } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { DEFAULT_SETTINGS } from '../lib/demoData';

export const Settings: React.FC = () => {
  const { settings, updateSettings } = useTraffic();

  return (
    <div className="flex-1 flex flex-col p-5 gap-4 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight">
          System Configuration & Controller Constraints
        </h1>
        <p className="text-xs text-text-secondary mt-0.5">
          Tune safety bounds, optimization heuristics, and visual preferences
        </p>
      </div>

      {/* Safety Bounds Section */}
      <div className="p-4 rounded-xl bg-bg-panel border border-border flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <ShieldCheck className="w-4 h-4 text-cyan" />
          <h2 className="text-sm font-semibold text-text-primary">Signal Timing Safety Bounds</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Minimum Green Time (s)
            </label>
            <input
              type="number"
              min="5"
              max="20"
              value={settings.minGreenSeconds}
              onChange={(e) => updateSettings({ minGreenSeconds: Number(e.target.value) })}
              className="w-full bg-[#0E1726] border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-cyan"
            />
            <span className="text-[10px] text-text-muted mt-1 block">
              Guarantees pedestrian clearance time.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Maximum Green Time (s)
            </label>
            <input
              type="number"
              min="30"
              max="90"
              value={settings.maxGreenSeconds}
              onChange={(e) => updateSettings({ maxGreenSeconds: Number(e.target.value) })}
              className="w-full bg-[#0E1726] border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-cyan"
            />
            <span className="text-[10px] text-text-muted mt-1 block">
              Prevents arterial green starvation.
            </span>
          </div>

          <div>
            <label className="text-xs font-medium text-text-secondary block mb-1">
              Clearance Interval (s)
            </label>
            <input
              type="number"
              min="4"
              max="8"
              value={settings.clearanceSeconds}
              onChange={(e) => updateSettings({ clearanceSeconds: Number(e.target.value) })}
              className="w-full bg-[#0E1726] border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-primary focus:outline-none focus:border-cyan"
            />
            <span className="text-[10px] text-text-muted mt-1 block">
              Amber plus all-red intersection clear time.
            </span>
          </div>
        </div>
      </div>

      {/* AI Controller Heuristics */}
      <div className="p-4 rounded-xl bg-bg-panel border border-border flex flex-col gap-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border/40">
          <SettingsIcon className="w-4 h-4 text-cyan" />
          <h2 className="text-sm font-semibold text-text-primary">Optimization Heuristic Profile</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['conservative', 'balanced', 'aggressive'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => updateSettings({ aiSensitivity: mode })}
              className={`p-3 rounded-lg border text-left transition-all ${
                settings.aiSensitivity === mode
                  ? 'bg-cyan-dark/60 border-cyan text-text-primary'
                  : 'bg-[#0E1726] border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <span className="font-semibold text-xs capitalize block">{mode}</span>
              <span className="text-[11px] text-text-muted mt-0.5 block">
                {mode === 'conservative'
                  ? 'Strict adherence to cycle continuity with subtle ±5s green adjustments.'
                  : mode === 'balanced'
                  ? 'Dynamic Webster rebalancing without exceeding cycle budgets.'
                  : 'Aggressive platoon flushing with priority green preemption.'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Reset button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => updateSettings(DEFAULT_SETTINGS)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#142233] border border-border text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset to Factory Defaults</span>
        </button>
      </div>
    </div>
  );
};
