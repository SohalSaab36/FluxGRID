import React from 'react';
import { Car, Activity, Clock, Radio } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';
import { Sparkline } from '../ui/Sparkline';
import { Intersection } from '../../types/traffic';

interface KpiCardsProps {
  intersections?: Intersection[];
}

export const KpiCards: React.FC<KpiCardsProps> = ({ intersections }) => {
  const { kpis } = useTraffic();
  const scopedIntersections = intersections ?? [];
  const hasScopedIntersections = intersections !== undefined;
  const clearCount = scopedIntersections.filter((item) => item.congestion === 'clear').length;
  const moderateCount = scopedIntersections.filter((item) => item.congestion === 'moderate').length;
  const heavyCount = scopedIntersections.filter((item) => item.congestion === 'heavy').length;
  const approachWaits = scopedIntersections.flatMap((item) =>
    Object.values(item.approaches).map((approach) => approach.averageWaitSeconds),
  );
  const scopedKpis = hasScopedIntersections
    ? {
        vehiclesInNetwork: scopedIntersections.reduce((total, item) => total + item.totalVehicles, 0),
        cameraFeedCount: scopedIntersections.length,
        networkCongestionPct: scopedIntersections.length
          ? Math.round(((moderateCount + heavyCount) / scopedIntersections.length) * 100)
          : 0,
        clearCount,
        moderateCount,
        heavyCount,
        averageWaitSeconds: approachWaits.length
          ? Math.round(approachWaits.reduce((total, wait) => total + wait, 0) / approachWaits.length)
          : 0,
        adaptiveSignalsOnline: scopedIntersections.filter((item) => item.controllerMode === 'adaptive').length,
        totalSignals: scopedIntersections.length,
      }
    : kpis;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Vehicles in network */}
      <div className="bg-bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-border-highlight transition-all">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Vehicles in network</span>
          <Car className="w-3.5 h-3.5 text-text-muted group-hover:text-cyan transition-colors" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {scopedKpis.vehiclesInNetwork.toLocaleString()}
          </span>
          <span className="text-[10px] font-medium text-cyan bg-cyan-dark/80 px-1.5 py-0.5 rounded border border-cyan/20">
            {hasScopedIntersections ? 'selected area' : `${kpis.vehiclesDeltaPct >= 0 ? '+' : ''}${kpis.vehiclesDeltaPct}% vs prior 15 min`}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Across {scopedKpis.cameraFeedCount} camera feeds</span>
          <Sparkline
            data={[1240, 1248, 1255, 1250, 1272, 1268, scopedKpis.vehiclesInNetwork]}
            color="#31D7E8"
            width={60}
            height={20}
          />
        </div>
      </div>

      {/* Card 2: Network congestion */}
      <div className="bg-bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-border-highlight transition-all">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Network congestion</span>
          <Activity className="w-3.5 h-3.5 text-text-muted group-hover:text-warning transition-colors" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {scopedKpis.networkCongestionPct}%
          </span>
          <span className="text-[10px] font-medium text-warning bg-warning-dark/80 px-1.5 py-0.5 rounded border border-warning/20">
            {scopedKpis.clearCount} intersections clear
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {scopedKpis.moderateCount} moderate · {scopedKpis.heavyCount} heavy
          </span>
          <Sparkline
            data={[38, 44, 40, 46, 43, 45, scopedKpis.networkCongestionPct]}
            color="#F4B84A"
            width={60}
            height={20}
          />
        </div>
      </div>

      {/* Card 3: Average wait time */}
      <div className="bg-bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-border-highlight transition-all">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Average wait time</span>
          <Clock className="w-3.5 h-3.5 text-text-muted group-hover:text-success transition-colors" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {scopedKpis.averageWaitSeconds} s
          </span>
          <span className="text-[10px] font-medium text-success bg-success-dark/80 px-1.5 py-0.5 rounded border border-success/20">
            {kpis.adaptiveWaitDeltaPct}% with adaptive AI
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>Fixed-timing baseline: {kpis.fixedBaselineWaitSeconds} s</span>
          <Sparkline
            data={[55, 52, 47, 41, 37, 35, scopedKpis.averageWaitSeconds]}
            color="#39D9A5"
            width={60}
            height={20}
          />
        </div>
      </div>

      {/* Card 4: Adaptive signals online */}
      <div className="bg-bg-panel border border-border rounded-xl p-3.5 flex flex-col justify-between relative overflow-hidden group hover:border-border-highlight transition-all">
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>Adaptive signals online</span>
          <Radio className="w-3.5 h-3.5 text-text-muted group-hover:text-cyan transition-colors" />
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-text-primary">
            {scopedKpis.adaptiveSignalsOnline} / {scopedKpis.totalSignals}
          </span>
          <span className="text-[10px] font-medium text-cyan bg-cyan-dark/80 px-1.5 py-0.5 rounded border border-cyan/20">
            {kpis.engineUptimePct}% engine uptime
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>All intersections connected</span>
          <Sparkline
            data={[10, 11, 11, 12, 12, 12, kpis.adaptiveSignalsOnline]}
            color="#31D7E8"
            width={60}
            height={20}
          />
        </div>
      </div>
    </div>
  );
};
