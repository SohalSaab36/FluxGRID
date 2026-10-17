import React, { useState } from 'react';
import { TrendingUp, ChevronDown, ExternalLink } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from 'recharts';
import { useTraffic } from '../../context/TrafficContext';

export const PerformancePanel: React.FC = () => {
  const { performanceData, kpis, timeRange, setTimeRange, setCurrentView } = useTraffic();
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const ranges = ['Last 15 minutes', 'Last 30 minutes', 'Last 45 minutes', 'Last 2 hours'];

  return (
    <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col justify-between gap-3 select-none">
      {/* Header Row (matches screenshot) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan" />
          <span className="text-sm font-semibold text-text-primary">
            Performance impact
          </span>
        </div>

        {/* Time Range Selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#0E1726] border border-border text-xs text-text-secondary hover:text-text-primary hover:border-cyan/40 transition-colors"
          >
            <span>{timeRange}</span>
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 rounded-md bg-[#111C2B] border border-border shadow-xl py-1 z-30 text-xs">
              {ranges.map((range) => (
                <button
                  key={range}
                  onClick={() => {
                    setTimeRange(range);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#152538] text-text-primary"
                >
                  {range}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3 Headline Metrics Row (matches screenshot) */}
      <div className="grid grid-cols-3 gap-2 py-1 border-b border-border/40">
        {/* Metric 1: Average wait */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-cyan tracking-tight">
              {kpis.adaptiveWaitDeltaPct}%
            </span>
            <span className="text-xs text-text-secondary">Average wait</span>
          </div>
          <span className="text-[10px] text-text-muted">
            {kpis.fixedBaselineWaitSeconds} s → {kpis.averageWaitSeconds} s
          </span>
        </div>

        {/* Metric 2: Throughput */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-success tracking-tight">
              +{kpis.throughputDeltaPct}%
            </span>
            <span className="text-xs text-text-secondary">Throughput</span>
          </div>
          <span className="text-[10px] text-text-muted">
            1,484 → {kpis.throughputVehPerHour} veh/h
          </span>
        </div>

        {/* Metric 3: Est CO2 emissions */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-cyan tracking-tight">
              {kpis.co2EmissionsReductionPct}%
            </span>
            <span className="text-xs text-text-secondary">Est. CO₂ emissions</span>
          </div>
          <span className="text-[10px] text-text-muted">
            Idling-based model
          </span>
        </div>
      </div>

      {/* Recharts Chart Area */}
      <div className="relative w-full h-[145px]">
        {/* Chart Title and Legend Header */}
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1 px-1">
          <span>Average wait time (seconds)</span>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-dashed border-[#5F738E]" />
              <span>Fixed timing</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-t-2 border-cyan" />
              <span className="text-cyan">CityFlow AI</span>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={125}>
          <AreaChart data={performanceData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <defs>
              <linearGradient id="aiWaitGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#31D7E8" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#31D7E8" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#18273A" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#4D5F76"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#243449' }}
            />
            <YAxis
              domain={[10, 65]}
              ticks={[20, 40, 60]}
              stroke="#4D5F76"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#243449' }}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-md bg-[#0B1524] border border-border p-2 text-[10px] shadow-xl">
                      <p className="font-semibold text-text-primary">{payload[0]?.payload.time}</p>
                      <p className="text-text-muted">
                        Fixed Timing: <span className="text-text-primary font-mono">{payload[1]?.value} s</span>
                      </p>
                      <p className="text-cyan font-semibold">
                        CityFlow AI: <span className="font-mono">{payload[0]?.value} s</span>
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            {/* CityFlow AI Area & Line */}
            <Area
              type="monotone"
              dataKey="aiWait"
              stroke="#31D7E8"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#aiWaitGlow)"
            />
            {/* Fixed Timing Baseline Dashed Line */}
            <Line
              type="monotone"
              dataKey="fixedWait"
              stroke="#5F738E"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Current Value Marker Tag */}
        <div className="absolute right-3 bottom-5 px-1 py-0.2 rounded bg-cyan-dark border border-cyan/40 text-[9px] font-mono text-cyan">
          {kpis.averageWaitSeconds} s
        </div>
      </div>

      {/* Footer Row (matches screenshot) */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
        <span className="text-[11px] text-text-muted">
          Same demand · Fixed 65 s cycle vs adaptive AI
        </span>
        <button
          onClick={() => setCurrentView('analytics')}
          className="flex items-center gap-1 text-xs text-cyan hover:underline transition-colors"
        >
          <span>View analytics</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
