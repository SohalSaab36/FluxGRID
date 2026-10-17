import React from 'react';
import { TrendingUp, Download, Clock, Zap, Leaf, Activity } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useTraffic } from '../context/TrafficContext';

export const PerformanceAnalytics: React.FC = () => {
  const { performanceData, kpis, exportReport } = useTraffic();

  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Performance Analytics & Impact Evaluation
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Comparative analysis of adaptive AI optimization against pre-timed baseline schedules
          </p>
        </div>

        <button
          onClick={exportReport}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan text-[#080F1B] font-semibold text-xs hover:bg-cyan-hover transition-colors shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Analytics CSV</span>
        </button>
      </div>

      {/* Top 3 Impact Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-bg-panel border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted">Average Wait Reduction</span>
            <div className="text-2xl font-bold text-cyan mt-1">{kpis.adaptiveWaitDeltaPct}%</div>
            <span className="text-[11px] text-text-secondary">
              Baseline: {kpis.fixedBaselineWaitSeconds}s → AI: {kpis.averageWaitSeconds}s
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-dark/60 text-cyan">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-panel border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted">Network Throughput Increase</span>
            <div className="text-2xl font-bold text-success mt-1">+{kpis.throughputDeltaPct}%</div>
            <span className="text-[11px] text-text-secondary">
              1,484 → {kpis.throughputVehPerHour} vehicles/hour
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-success-dark/60 text-success">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-bg-panel border border-border flex items-center justify-between">
          <div>
            <span className="text-xs text-text-muted">Estimated CO₂ Reduction</span>
            <div className="text-2xl font-bold text-cyan mt-1">{kpis.co2EmissionsReductionPct}%</div>
            <span className="text-[11px] text-text-secondary">
              Idling deceleration model
            </span>
          </div>
          <div className="p-2.5 rounded-lg bg-cyan-dark/60 text-cyan">
            <Leaf className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: Average Wait Time Timeline */}
        <div className="p-4 rounded-xl bg-bg-panel border border-border flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-primary">
            Average Wait Time: Fixed Timing vs CityFlow AI
          </span>
          <p className="text-[11px] text-text-muted">
            Continuous delay tracking across 12 downtown intersections.
          </p>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18273A" vertical={false} />
                <XAxis dataKey="time" stroke="#4D5F76" fontSize={11} />
                <YAxis stroke="#4D5F76" fontSize={11} domain={[0, 70]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1524', borderColor: '#243449', borderRadius: '8px' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="fixedWait"
                  name="Fixed Timing Baseline (s)"
                  stroke="#5F738E"
                  fill="#5F738E"
                  fillOpacity={0.1}
                />
                <Area
                  type="monotone"
                  dataKey="aiWait"
                  name="CityFlow AI (s)"
                  stroke="#31D7E8"
                  fill="#31D7E8"
                  fillOpacity={0.25}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Throughput Capacity Comparison */}
        <div className="p-4 rounded-xl bg-bg-panel border border-border flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-primary">
            Corridor Throughput Flow (Vehicles / Hour)
          </span>
          <p className="text-[11px] text-text-muted">
            Total vehicle clearances served under identical demand arrivals.
          </p>
          <div className="h-64 mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#18273A" vertical={false} />
                <XAxis dataKey="time" stroke="#4D5F76" fontSize={11} />
                <YAxis stroke="#4D5F76" fontSize={11} domain={[1200, 2000]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0B1524', borderColor: '#243449', borderRadius: '8px' }}
                />
                <Bar dataKey="throughput" name="Processed Flow Rate (veh/h)" fill="#39D9A5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
