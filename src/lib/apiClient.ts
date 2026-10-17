import {
  Intersection,
  NetworkKPIs,
  PerformanceTimePoint,
  SimulationScenario,
  SimulationScenarioId,
  SimulationSettings,
  TrafficReport,
  TrafficReportType,
  VehicleDetectionCount,
  Account,
} from '../types/traffic';

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export function isApiConfigured(): boolean {
  return API_BASE_URL.length > 0 || import.meta.env.DEV;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload?.error) detail = payload.error;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, response.status);
  }
  if (response.headers.get('content-type')?.includes('text/csv')) {
    return (await response.text()) as T;
  }
  return response.json() as Promise<T>;
}

export interface SimulationStatePayload {
  status: 'running' | 'paused';
  controllerMode: 'adaptive' | 'fixed';
  simulatedClockSeconds: number;
  simulationSpeed: number;
  scenario: SimulationScenario;
  scenarios: SimulationScenario[];
  intersections: Intersection[];
  kpis: NetworkKPIs;
  detection: VehicleDetectionCount & { dataProvenance?: string; note?: string };
  performanceData: PerformanceTimePoint[];
  settings: Pick<
    SimulationSettings,
    'minGreenSeconds' | 'maxGreenSeconds' | 'clearanceSeconds' | 'aiSensitivity'
  >;
}

export interface DetectionAnalyzeResult {
  status: string;
  error?: string;
  processedFrames?: number;
  countsByClass?: {
    car: number;
    motorcycle: number;
    bus: number;
    truck: number;
  };
  meanConfidence?: number;
  processingDurationSeconds?: number;
  dataProvenance?: string;
  model?: {
    modelLoaded: boolean;
    weightsAvailable: boolean;
    device: string;
  };
}

export interface TrafficReportInput {
  type: TrafficReportType;
  description: string;
  latitude: number;
  longitude: number;
}

export interface RoutePlace {
  id: string;
  name: string;
  coordinates: [number, number];
}

export interface PlannedRoute {
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  distanceKm: number;
  baseDurationSeconds: number;
  estimatedDurationSeconds: number;
  congestionScore: number | null;
  riskLabel: string;
  estimateScope: 'route-local' | 'regional-demo';
  activeReports: number;
  matchedIntersections: {
    id: string;
    code: string;
    name: string;
    distanceKm: number;
    congestion: string;
    activeReports: number;
  }[];
}

export interface RoutePlan {
  origin: RoutePlace;
  destination: RoutePlace;
  routes: PlannedRoute[];
  recommendedRouteId: string;
  routingProvider: string;
  trafficEstimate: string;
  trafficDataNote: string;
}

export const api = {
  health: () => request<{ status: string; yoloAvailable: boolean; modelLoaded: boolean }>('/api/health'),
  currentAccount: () => request<{ user: Account | null }>('/api/auth/me'),
  requestSignupPhoneVerification: (phone: string) =>
    request<{ message: string }>('/api/auth/signup/phone-verification', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),
  signup: (profile: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    password: string;
    phoneVerificationCode: string;
  }) =>
    request<{ user: Account }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(profile),
    }),
  login: (email: string, password: string) =>
    request<{ user: Account }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request<{ user: null }>('/api/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/api/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    request<{ message: string }>('/api/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    }),
  pendingAccidentReports: () =>
    request<{ reports: TrafficReport[] }>('/api/admin/traffic/reports/pending'),
  decideAccidentReport: (reportId: string, decision: 'approve' | 'reject') =>
    request<{ report: TrafficReport }>(`/api/admin/traffic/reports/${reportId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    }),
  state: () => request<SimulationStatePayload>('/api/simulation/state'),
  start: () => request<SimulationStatePayload>('/api/simulation/start', { method: 'POST' }),
  pause: () => request<SimulationStatePayload>('/api/simulation/pause', { method: 'POST' }),
  reset: () => request<SimulationStatePayload>('/api/simulation/reset', { method: 'POST' }),
  setMode: (mode: 'adaptive' | 'fixed', intersectionId?: string) =>
    request<SimulationStatePayload>('/api/simulation/mode', {
      method: 'POST',
      body: JSON.stringify({ mode, intersectionId }),
    }),
  setScenario: (scenarioId: SimulationScenarioId | string) =>
    request<{ scenario: SimulationScenario; state: SimulationStatePayload }>('/api/simulation/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenarioId }),
    }),
  step: (seconds: number) =>
    request<SimulationStatePayload>('/api/simulation/step', {
      method: 'POST',
      body: JSON.stringify({ seconds }),
    }),
  setSpeed: (speed: number) =>
    request<SimulationStatePayload>('/api/simulation/speed', {
      method: 'POST',
      body: JSON.stringify({ speed }),
    }),
  updateSettings: (partial: Partial<SimulationSettings>) =>
    request<SimulationStatePayload>('/api/simulation/settings', {
      method: 'POST',
      body: JSON.stringify(partial),
    }),
  trafficReports: () =>
    request<{
      reports: TrafficReport[];
      dataProvenance: string;
      expiresAfterSeconds: number;
      maxDistanceKm: number;
    }>(
      '/api/traffic/reports'
    ),
  createTrafficReport: (report: TrafficReportInput) =>
    request<{ report: TrafficReport; dataProvenance: string }>('/api/traffic/reports', {
      method: 'POST',
      body: JSON.stringify(report),
    }),
  routingPlaces: () => request<{ places: RoutePlace[] }>('/api/routing/places'),
  planRoute: (originId: string, destinationId: string) =>
    request<RoutePlan>('/api/routing/plan', {
      method: 'POST',
      body: JSON.stringify({ originId, destinationId }),
    }),
  compare: () => request<{ performanceData: PerformanceTimePoint[]; summary: Record<string, number | null> }>(
    '/api/simulation/compare',
    { method: 'POST', body: JSON.stringify({ durationSeconds: 300 }) }
  ),
  exportCsv: () => request<string>('/api/metrics/export'),
  detectionStatus: () =>
    request<{ weightsAvailable: boolean; modelLoaded: boolean; inferenceStatus: string }>(
      '/api/detection/status'
    ),
  analyzeVideo: async (file: File): Promise<DetectionAnalyzeResult> => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_BASE_URL}/api/detection/analyze`, {
      method: 'POST',
      body: form,
    });
    const payload = (await response.json()) as DetectionAnalyzeResult;
    if (!response.ok && payload.status !== 'unavailable') {
      throw new ApiError(payload.error || 'Detection failed', response.status);
    }
    return payload;
  },
};
