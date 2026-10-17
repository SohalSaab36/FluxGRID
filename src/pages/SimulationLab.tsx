import React, { useState } from 'react';
import { FlaskConical, Play, Pause, RotateCcw, FastForward, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { SimulationScenarioId } from '../types/traffic';

export const SimulationLab: React.FC = () => {
  const {
    scenarios,
    currentScenario,
    setScenario,
    isSimulationRunning,
    toggleSimulation,
    resetSimulation,
    simulationSpeed,
    setSimulationSpeed,
    kpis,
  } = useTraffic();

  const [logs, setLogs] = useState<string[]>([
    'Simulation initialized: Scenario CF-024 (Downtown grid · PM peak)',
    'Safety checks: PASSED (Minimum green >= 10s constraint active)',
    'Webster phase optimization: J04 N-S green extended by +12s',
    'Arterial coordination: Green wave synchronized along Central Ave',
  ]);

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Simulation Lab & Scenario Sandbox
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Test traffic resilience under extreme congestion, weather events, and incident scenarios
          </p>
        </div>

        {/* Global Play/Pause/Reset Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSimulation}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
              isSimulationRunning
                ? 'bg-warning text-black hover:bg-warning/90'
                : 'bg-success text-black hover:bg-success/90'
            }`}
          >
            {isSimulationRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isSimulationRunning ? 'Pause Engine' : 'Resume Engine'}</span>
          </button>

          <button
            onClick={resetSimulation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#142233] border border-border text-xs text-text-secondary hover:text-text-primary hover:border-cyan/40 transition-colors shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Speed & Multiplier Bar */}
      <div className="p-3 rounded-xl bg-bg-panel border border-border flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">Clock Acceleration:</span>
          <div className="flex items-center rounded-lg bg-[#0E1726] border border-border p-0.5">
            {[0.5, 1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimulationSpeed(spd)}
                className={`px-3 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                  simulationSpeed === spd
                    ? 'bg-cyan text-black font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="text-text-muted">Status:</span>
          <span className="flex items-center gap-1.5 font-semibold text-text-primary">
            <span className={`w-2 h-2 rounded-full ${isSimulationRunning ? 'bg-success animate-pulse' : 'bg-warning'}`} />
            {isSimulationRunning ? `Simulating at ${simulationSpeed}x speed` : 'Paused'}
          </span>
        </div>
      </div>

      {/* Scenario Grid */}
      <div>
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
          Select Simulation Scenario
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {scenarios.map((scen) => {
            const isSelected = currentScenario.id === scen.id;
            return (
              <div
                key={scen.id}
                onClick={() => setScenario(scen.id as SimulationScenarioId)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#152538] border-cyan shadow-lg'
                    : 'bg-bg-panel border-border/70 hover:border-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#0E1726] text-cyan border border-cyan/20">
                    {scen.code}
                  </span>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-cyan" />}
                </div>

                <h3 className="text-sm font-bold text-text-primary mt-2">{scen.name}</h3>
                <p className="text-xs text-text-secondary mt-1">{scen.description}</p>

                <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-text-muted">
                  <span>Arrival Demand: {(scen.arrivalMultiplier * 100).toFixed(0)}%</span>
                  <span>Incident: {scen.incidentSeverity > 0 ? 'Active' : 'None'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Event Stream Log */}
      <div className="p-4 rounded-xl bg-bg-panel border border-border flex flex-col gap-2">
        <div className="flex items-center justify-between pb-2 border-b border-border/40 text-xs">
          <span className="font-semibold text-text-primary">Live Controller Telemetry Log</span>
          <span className="text-text-muted font-mono">Buffer: 4 events</span>
        </div>
        <div className="font-mono text-xs space-y-1.5 text-text-secondary">
          {logs.map((log, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-cyan">[{new Date().toLocaleTimeString()}]</span>
              <span>{log}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
