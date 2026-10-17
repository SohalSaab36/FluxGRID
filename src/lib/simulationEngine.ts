import {
  Intersection,
  NetworkKPIs,
  SimulationScenario,
  SimulationSettings,
  VehicleDetectionCount,
  PerformanceTimePoint
} from '../types/traffic';
import { calculateAdaptiveTimings, applyAiTimingsToPhases } from './trafficController';

export interface SimulationTickResult {
  intersections: Intersection[];
  kpis: NetworkKPIs;
  detection: VehicleDetectionCount;
  performanceData: PerformanceTimePoint[];
}

export function runSimulationStep(
  currentIntersections: Intersection[],
  currentKpis: NetworkKPIs,
  currentDetection: VehicleDetectionCount,
  performanceHistory: PerformanceTimePoint[],
  scenario: SimulationScenario,
  settings: SimulationSettings,
  stepSeconds: number = 1
): SimulationTickResult {
  const mult = scenario.arrivalMultiplier;

  let totalVehicles = 0;
  let totalWaitingSeconds = 0;
  let totalWaitingVehicles = 0;
  let clearCount = 0;
  let moderateCount = 0;
  let heavyCount = 0;

  const updatedIntersections = currentIntersections.map((intersection) => {
    let {
      currentPhase,
      phaseRemainingSeconds,
      approaches,
      phases,
      controllerMode
    } = intersection;

    // 1. Decrement countdown
    phaseRemainingSeconds -= stepSeconds;

    // Determine target durations
    const nsPhase = phases.find((p) => p.type === 'ns-green') || phases[0];
    const ewPhase = phases.find((p) => p.type === 'ew-green') || phases[1];
    const clearancePhase = phases.find((p) => p.type === 'clearance') || phases[2];

    const getDuration = (phase: typeof nsPhase) =>
      controllerMode === 'adaptive' ? phase.aiDuration : phase.fixedDuration;

    // 2. Transition phase if expired
    if (phaseRemainingSeconds <= 0) {
      if (currentPhase === 'North-South green') {
        currentPhase = 'Clearance interval';
        phaseRemainingSeconds = getDuration(clearancePhase);
      } else if (currentPhase === 'Clearance interval') {
        // Was it clearing after NS or EW?
        const wasNs = approaches.north.currentSignal !== 'red';
        if (wasNs) {
          currentPhase = 'East-West green';
          phaseRemainingSeconds = getDuration(ewPhase);
        } else {
          currentPhase = 'North-South green';
          phaseRemainingSeconds = getDuration(nsPhase);
        }
      } else {
        // East-West green expired
        currentPhase = 'Clearance interval';
        phaseRemainingSeconds = getDuration(clearancePhase);
      }
    }

    // 3. Update approach signal states based on active phase
    const isNsGreen = currentPhase === 'North-South green';
    const isEwGreen = currentPhase === 'East-West green';
    const isClearance = currentPhase === 'Clearance interval';

    const northSignal = isNsGreen ? 'green' : isClearance && approaches.north.currentSignal === 'green' ? 'amber' : 'red';
    const southSignal = isNsGreen ? 'green' : isClearance && approaches.south.currentSignal === 'green' ? 'amber' : 'red';
    const eastSignal = isEwGreen ? 'green' : isClearance && approaches.east.currentSignal === 'green' ? 'amber' : 'red';
    const westSignal = isEwGreen ? 'green' : isClearance && approaches.west.currentSignal === 'green' ? 'amber' : 'red';

    // 4. Update approach queues and vehicle flow
    const updateApproach = (approach: typeof approaches.north, signal: typeof northSignal) => {
      // Natural arrivals
      const arrivalRate = (approach.flowRateVehPerHour / 3600) * mult;
      const arrivals = Math.random() < arrivalRate ? 1 : 0;

      // Discharges during green (approx 1 vehicle per 2.2 seconds)
      const dischargeRate = signal === 'green' ? 0.45 : signal === 'amber' ? 0.2 : 0;
      const departures = (Math.random() < dischargeRate && approach.vehiclesInQueue > 0) ? 1 : 0;

      const newQueue = Math.max(0, approach.vehiclesInQueue + arrivals - departures);

      // Wait time calculation
      let wait = approach.averageWaitSeconds;
      if (signal === 'red') {
        wait = Math.min(90, wait + (newQueue > 0 ? 0.8 : 0));
      } else {
        wait = Math.max(8, wait - 0.7);
      }

      return {
        ...approach,
        vehiclesInQueue: newQueue,
        averageWaitSeconds: Math.round(wait * 10) / 10,
        currentSignal: signal,
      };
    };

    const newNorth = updateApproach(approaches.north, northSignal);
    const newSouth = updateApproach(approaches.south, southSignal);
    const newEast = updateApproach(approaches.east, eastSignal);
    const newWest = updateApproach(approaches.west, westSignal);

    const totalQueue = newNorth.vehiclesInQueue + newSouth.vehiclesInQueue + newEast.vehiclesInQueue + newWest.vehiclesInQueue;
    const totalVeh = intersection.totalVehicles + (Math.random() > 0.5 ? 1 : -1);

    // Congestion determination
    let congestion: 'clear' | 'moderate' | 'heavy' = 'clear';
    if (totalQueue > 20) {
      congestion = 'heavy';
      heavyCount++;
    } else if (totalQueue >= 10) {
      congestion = 'moderate';
      moderateCount++;
    } else {
      congestion = 'clear';
      clearCount++;
    }

    // AI optimization calculation
    const dummyIntersection = {
      ...intersection,
      approaches: { north: newNorth, south: newSouth, east: newEast, west: newWest },
    };
    const recommendation = calculateAdaptiveTimings(dummyIntersection, settings);
    const updatedPhases = applyAiTimingsToPhases(phases, recommendation);

    // Active phase indicator
    const updatedPhasesWithActive = updatedPhases.map((p) => ({
      ...p,
      active: p.name === currentPhase,
    }));

    totalVehicles += totalVeh;
    totalWaitingSeconds += (newNorth.averageWaitSeconds * newNorth.vehiclesInQueue +
      newSouth.averageWaitSeconds * newSouth.vehiclesInQueue +
      newEast.averageWaitSeconds * newEast.vehiclesInQueue +
      newWest.averageWaitSeconds * newWest.vehiclesInQueue);
    totalWaitingVehicles += Math.max(1, totalQueue);

    return {
      ...intersection,
      totalVehicles: Math.max(20, totalVeh),
      queueLength: totalQueue,
      currentPhase,
      phaseRemainingSeconds: Math.max(1, phaseRemainingSeconds),
      congestion,
      aiRecommendation: recommendation.primaryAction,
      aiRecommendationReason: recommendation.reason,
      safetyPassed: recommendation.safetyPassed,
      approaches: {
        north: newNorth,
        south: newSouth,
        east: newEast,
        west: newWest,
      },
      phases: updatedPhasesWithActive,
    };
  });

  // Calculate network average wait
  const networkAvgWait = Math.round(totalWaitingSeconds / Math.max(1, totalWaitingVehicles));
  const fixedBaseline = 55;
  const adaptiveDeltaPct = Math.round(((networkAvgWait - fixedBaseline) / fixedBaseline) * 100);

  // Network congestion % based on max capacity
  const networkCongestionPct = Math.min(95, Math.round((totalWaitingVehicles / (currentIntersections.length * 28)) * 100));

  const updatedKpis: NetworkKPIs = {
    ...currentKpis,
    vehiclesInNetwork: Math.round(totalVehicles * 0.9 + 1284 * 0.1),
    networkCongestionPct: Math.max(25, networkCongestionPct),
    clearCount,
    moderateCount,
    heavyCount,
    averageWaitSeconds: Math.max(18, networkAvgWait),
    adaptiveWaitDeltaPct: adaptiveDeltaPct,
    throughputVehPerHour: Math.round(1800 + (100 - networkCongestionPct) * 4),
  };

  // Small camera preview variation around active intersection
  const selectedInt = updatedIntersections.find((i) => i.id === 'int-04') || updatedIntersections[0];
  const updatedDetection: VehicleDetectionCount = {
    ...currentDetection,
    cars: Math.max(12, Math.min(26, Math.round(selectedInt.approaches.north.vehiclesInQueue * 0.75 + 2))),
    bikes: Math.max(2, Math.min(8, Math.round(selectedInt.approaches.south.vehiclesInQueue * 0.2 + 1))),
    buses: Math.max(1, Math.min(4, Math.round(selectedInt.approaches.east.vehiclesInQueue * 0.15 + 1))),
    confidence: Math.round((95.5 + Math.random() * 1.5) * 10) / 10,
  };

  return {
    intersections: updatedIntersections,
    kpis: updatedKpis,
    detection: updatedDetection,
    performanceData: performanceHistory,
  };
}
