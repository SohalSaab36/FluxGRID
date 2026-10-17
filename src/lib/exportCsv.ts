import { Intersection, NetworkKPIs, PerformanceTimePoint } from '../types/traffic';

export function exportTrafficDataToCsv(
  intersections: Intersection[],
  kpis: NetworkKPIs,
  performanceData: PerformanceTimePoint[]
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `CityFlow_Traffic_Report_${timestamp}.csv`;

  const rows: string[] = [];

  // Header and Metadata
  rows.push('# CityFlow AI / FluxGRID - Adaptive Traffic Intelligence Report');
  rows.push(`# Generated At: ${new Date().toUTCString()}`);
  rows.push('# Environment: Demonstration & Educational Simulation Model');
  rows.push('');

  // Section 1: Network KPIs
  rows.push('=== NETWORK OVERVIEW KPIS ===');
  rows.push('Metric,Value,Baseline / Reference,Delta');
  rows.push(`Vehicles in Network,${kpis.vehiclesInNetwork},Prior 15 min,${kpis.vehiclesDeltaPct >= 0 ? '+' : ''}${kpis.vehiclesDeltaPct}%`);
  rows.push(`Network Congestion,${kpis.networkCongestionPct}%,Capacity Baseline,"${kpis.clearCount} clear, ${kpis.moderateCount} moderate, ${kpis.heavyCount} heavy"`);
  rows.push(`Average Wait Time (s),${kpis.averageWaitSeconds},${kpis.fixedBaselineWaitSeconds} s (Fixed-timing),${kpis.adaptiveWaitDeltaPct}% with adaptive AI`);
  rows.push(`Adaptive Signals Online,${kpis.adaptiveSignalsOnline}/${kpis.totalSignals},Engine Uptime,${kpis.engineUptimePct}%`);
  rows.push(`Throughput (veh/h),${kpis.throughputVehPerHour},Baseline 1484 veh/h,+${kpis.throughputDeltaPct}%`);
  rows.push(`Estimated CO2 Reduction,${kpis.co2EmissionsReductionPct}%,Idling-based model,Significant reduction`);
  rows.push('');

  // Section 2: Intersection Level Status
  rows.push('=== INTERSECTION DETAIL ===');
  rows.push('Code,Name,Congestion,Total Vehicles,Total Queue,Active Phase,Time Left (s),Mode,North Queue,South Queue,East Queue,West Queue,AI Recommendation');
  intersections.forEach((item) => {
    rows.push([
      item.code,
      `"${item.name}"`,
      item.congestion,
      item.totalVehicles,
      item.queueLength,
      `"${item.currentPhase}"`,
      item.phaseRemainingSeconds,
      item.controllerMode,
      item.approaches.north.vehiclesInQueue,
      item.approaches.south.vehiclesInQueue,
      item.approaches.east.vehiclesInQueue,
      item.approaches.west.vehiclesInQueue,
      `"${item.aiRecommendation}"`
    ].join(','));
  });
  rows.push('');

  // Section 3: Performance Trend Data
  rows.push('=== PERFORMANCE TIME SERIES ===');
  rows.push('Time,Fixed Timing Wait (s),CityFlow AI Wait (s),Throughput (veh/h),CO2 Index');
  performanceData.forEach((pt) => {
    rows.push(`${pt.time},${pt.fixedWait},${pt.aiWait},${pt.throughput},${pt.co2Index}`);
  });

  const csvContent = rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
