import { Intersection, SignalPhaseTiming, SimulationSettings } from '../types/traffic';

export interface SignalRecommendation {
  nsGreen: number;
  ewGreen: number;
  clearance: number;
  primaryAction: string;
  reason: string;
  safetyPassed: boolean;
}

/**
 * Computes AI adaptive signal timing based on approach queue lengths,
 * waiting starvation timers, and configurable safety bounds.
 */
export function calculateAdaptiveTimings(
  intersection: Intersection,
  settings: SimulationSettings
): SignalRecommendation {
  const { approaches } = intersection;
  const { minGreenSeconds, maxGreenSeconds, clearanceSeconds } = settings;

  // Queues
  const northQueue = approaches.north.vehiclesInQueue;
  const southQueue = approaches.south.vehiclesInQueue;
  const eastQueue = approaches.east.vehiclesInQueue;
  const westQueue = approaches.west.vehiclesInQueue;

  // Starvation penalties: if wait time exceeds 40s, add virtual weight
  const nsWaitPenalty = Math.max(approaches.north.averageWaitSeconds, approaches.south.averageWaitSeconds) > 40 ? 5 : 0;
  const ewWaitPenalty = Math.max(approaches.east.averageWaitSeconds, approaches.west.averageWaitSeconds) > 40 ? 5 : 0;

  // Critical approach load
  const nsLoad = Math.max(northQueue, southQueue) + nsWaitPenalty;
  const ewLoad = Math.max(eastQueue, westQueue) + ewWaitPenalty;
  const totalLoad = Math.max(1, nsLoad + ewLoad);

  // Available green budget (assuming total cycle around 66s or sum of fixed greens)
  const totalGreenBudget = (intersection.cycleLengthSeconds || 66) - clearanceSeconds;

  // Proportional allocation
  const nsRatio = nsLoad / totalLoad;
  let rawNsGreen = Math.round(totalGreenBudget * nsRatio);
  let rawEwGreen = totalGreenBudget - rawNsGreen;

  // Enforce min and max constraints
  let nsGreen = Math.max(minGreenSeconds, Math.min(maxGreenSeconds, rawNsGreen));
  let ewGreen = Math.max(minGreenSeconds, Math.min(maxGreenSeconds, rawEwGreen));

  // Re-normalize to cycle budget
  const actualGreenSum = nsGreen + ewGreen;
  if (actualGreenSum !== totalGreenBudget) {
    const diff = totalGreenBudget - actualGreenSum;
    if (nsLoad >= ewLoad && nsGreen + diff >= minGreenSeconds && nsGreen + diff <= maxGreenSeconds) {
      nsGreen += diff;
    } else if (ewGreen + diff >= minGreenSeconds && ewGreen + diff <= maxGreenSeconds) {
      ewGreen += diff;
    }
  }

  // Safety checks
  const safetyPassed =
    nsGreen >= minGreenSeconds &&
    nsGreen <= maxGreenSeconds &&
    ewGreen >= minGreenSeconds &&
    ewGreen <= maxGreenSeconds &&
    clearanceSeconds >= 4;

  let primaryAction = 'Maintain balanced phase allocation';
  let reason = 'Demand is evenly distributed across corridors.';

  if (nsLoad > ewLoad * 1.4) {
    primaryAction = `Prioritize northbound queue - ${northQueue} waiting vehicles`;
    reason = `Rebalances green time without extending the ${intersection.cycleLengthSeconds} s cycle.`;
  } else if (ewLoad > nsLoad * 1.4) {
    primaryAction = `Prioritize eastbound corridor - ${eastQueue} waiting vehicles`;
    reason = `Extends cross-street green to relieve arterial bottleneck.`;
  }

  return {
    nsGreen,
    ewGreen,
    clearance: clearanceSeconds,
    primaryAction,
    reason,
    safetyPassed,
  };
}

export function applyAiTimingsToPhases(
  phases: SignalPhaseTiming[],
  recommendation: SignalRecommendation
): SignalPhaseTiming[] {
  return phases.map((phase) => {
    if (phase.type === 'ns-green') {
      const change = recommendation.nsGreen - phase.fixedDuration;
      return {
        ...phase,
        aiDuration: recommendation.nsGreen,
        changeSeconds: change,
      };
    }
    if (phase.type === 'ew-green') {
      const change = recommendation.ewGreen - phase.fixedDuration;
      return {
        ...phase,
        aiDuration: recommendation.ewGreen,
        changeSeconds: change,
      };
    }
    if (phase.type === 'clearance') {
      return {
        ...phase,
        aiDuration: recommendation.clearance,
        changeSeconds: 0,
      };
    }
    return phase;
  });
}
