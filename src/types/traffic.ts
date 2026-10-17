export type CongestionLevel = 'clear' | 'moderate' | 'heavy';

export type SignalColor = 'green' | 'amber' | 'red';

export interface ApproachData {
  direction: 'North' | 'South' | 'East' | 'West';
  vehiclesInQueue: number;
  flowRateVehPerHour: number;
  averageWaitSeconds: number;
  currentSignal: SignalColor;
  greenAllocatedSeconds: number;
}

export interface SignalPhaseTiming {
  id: string;
  name: string;
  fixedDuration: number;
  aiDuration: number;
  changeSeconds: number;
  active: boolean;
  type: 'ns-green' | 'ew-green' | 'clearance';
}

export interface Intersection {
  id: string;
  code: string; // e.g. "J04"
  name: string; // e.g. "Central & 5th"
  district: string; // e.g. "Downtown"
  coordinates: [number, number]; // [lng, lat]
  congestion: CongestionLevel;
  totalVehicles: number;
  queueLength: number;
  currentPhase: 'North-South green' | 'East-West green' | 'Clearance interval';
  phaseRemainingSeconds: number;
  cycleLengthSeconds: number;
  aiRecommendation: string;
  aiRecommendationReason: string;
  safetyPassed: boolean;
  controllerMode: 'adaptive' | 'fixed';
  approaches: {
    north: ApproachData;
    south: ApproachData;
    east: ApproachData;
    west: ApproachData;
  };
  phases: SignalPhaseTiming[];
  cameraFeedUrl?: string;
  cameraId: string;
}

export interface VehicleDetectionCount {
  cars: number;
  bikes: number;
  buses: number;
  trucks: number;
  pedestrians: number;
  confidence: number;
  cameraId: string;
  intersectionName: string;
  fps: number;
  latencyMs: number;
}

export interface NetworkKPIs {
  vehiclesInNetwork: number;
  vehiclesDeltaPct: number;
  cameraFeedCount: number;
  networkCongestionPct: number;
  clearCount: number;
  moderateCount: number;
  heavyCount: number;
  averageWaitSeconds: number;
  adaptiveWaitDeltaPct: number;
  fixedBaselineWaitSeconds: number;
  adaptiveSignalsOnline: number;
  totalSignals: number;
  engineUptimePct: number;
  throughputVehPerHour: number;
  throughputDeltaPct: number;
  co2EmissionsReductionPct: number;
}

export type SimulationScenarioId = 'pm-peak' | 'am-commute' | 'rain-storm' | 'incident-stall' | 'special-event';

export interface SimulationScenario {
  id: SimulationScenarioId;
  name: string;
  code: string;
  description: string;
  arrivalMultiplier: number;
  incidentSeverity: number;
}

export interface PerformanceTimePoint {
  time: string;
  fixedWait: number;
  aiWait: number;
  throughput: number;
  co2Index: number;
}

export interface SimulationSettings {
  minGreenSeconds: number;
  maxGreenSeconds: number;
  clearanceSeconds: number;
  aiSensitivity: 'conservative' | 'balanced' | 'aggressive';
  mapProvider: 'schematic' | 'openfreemap';
  soundAlerts: boolean;
  exportDelimiter: string;
}

export type TrafficReportType = 'congestion' | 'accident' | 'roadwork' | 'hazard' | 'closure';

export interface TrafficReport {
  id: string;
  type: TrafficReportType;
  description: string;
  coordinates: [number, number];
  intersectionId: string;
  intersectionName: string;
  intersectionCode: string;
  distanceKm: number;
  createdAt: string;
  expiresAt: string;
  verified: boolean;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  submittedBy: number | null;
}

export interface Account {
  id: number;
  email: string;
  role: 'user' | 'admin';
  fullName: string;
  phone: string;
  city: string;
}
