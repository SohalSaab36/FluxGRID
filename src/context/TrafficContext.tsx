import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Intersection,
  NetworkKPIs,
  VehicleDetectionCount,
  PerformanceTimePoint,
  SimulationScenario,
  SimulationScenarioId,
  SimulationSettings,
  TrafficReport,
  Account,
} from '../types/traffic';
import {
  INITIAL_INTERSECTIONS,
  INITIAL_KPIS,
  INITIAL_DETECTION,
  INITIAL_PERFORMANCE_DATA,
  SIMULATION_SCENARIOS,
  DEFAULT_SETTINGS
} from '../lib/demoData';
import { runSimulationStep } from '../lib/simulationEngine';
import { exportTrafficDataToCsv } from '../lib/exportCsv';
import {
  api,
  isApiConfigured,
  SimulationStatePayload,
  TrafficReportInput,
} from '../lib/apiClient';

export type DashboardView =
  | 'overview'
  | 'map'
  | 'intersections'
  | 'detection'
  | 'analytics'
  | 'simulation'
  | 'settings'
  | 'account'
  | 'admin';

interface TrafficContextType {
  intersections: Intersection[];
  selectedIntersection: Intersection;
  selectedIntersectionId: string;
  kpis: NetworkKPIs;
  detection: VehicleDetectionCount;
  performanceData: PerformanceTimePoint[];
  scenarios: SimulationScenario[];
  currentScenario: SimulationScenario;
  currentView: DashboardView;
  isSimulationRunning: boolean;
  simulationSpeed: number;
  settings: SimulationSettings;
  mapViewMode: 'schematic' | 'maplibre';
  timeRange: string;
  sidebarCollapsed: boolean;
  backendConnected: boolean;
  currentUser: Account | null;
  trafficReports: TrafficReport[];
  reportTtlSeconds: number;
  reportMaxDistanceKm: number;
  selectIntersection: (id: string) => void;
  setCurrentView: (view: DashboardView) => void;
  toggleSimulation: () => void;
  startSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  setScenario: (scenarioId: SimulationScenarioId) => void;
  toggleControllerMode: (intersectionId: string, mode?: 'adaptive' | 'fixed') => void;
  applyAiToIntersection: (intersectionId: string) => void;
  updateSettings: (partial: Partial<SimulationSettings>) => void;
  setMapViewMode: (mode: 'schematic' | 'maplibre') => void;
  setTimeRange: (range: string) => void;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  exportReport: () => void;
  analyzeUploadedVideo: (file: File) => Promise<void>;
  submitTrafficReport: (report: TrafficReportInput) => Promise<TrafficReport>;
  createAccount: (profile: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    password: string;
    phoneVerificationCode: string;
  }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  decideAccidentReport: (reportId: string, decision: 'approve' | 'reject') => Promise<void>;
}

const TrafficContext = createContext<TrafficContextType | undefined>(undefined);

export const TrafficProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [intersections, setIntersections] = useState<Intersection[]>(INITIAL_INTERSECTIONS);
  const [selectedIntersectionId, setSelectedIntersectionId] = useState<string>('int-04');
  const [kpis, setKpis] = useState<NetworkKPIs>(INITIAL_KPIS);
  const [detection, setDetection] = useState<VehicleDetectionCount>(INITIAL_DETECTION);
  const [performanceData, setPerformanceData] = useState<PerformanceTimePoint[]>(INITIAL_PERFORMANCE_DATA);
  const [scenarios, setScenarios] = useState<SimulationScenario[]>(SIMULATION_SCENARIOS);
  const [currentScenario, setCurrentScenario] = useState<SimulationScenario>(SIMULATION_SCENARIOS[0]);
  const [currentView, setCurrentView] = useState<DashboardView>('overview');
  const [isSimulationRunning, setIsSimulationRunning] = useState<boolean>(true);
  const [simulationSpeed, setSimulationSpeedState] = useState<number>(1);
  const [settings, setSettings] = useState<SimulationSettings>(DEFAULT_SETTINGS);
  const [mapViewMode, setMapViewMode] = useState<'schematic' | 'maplibre'>('maplibre');
  const [timeRange, setTimeRange] = useState<string>('Last 45 minutes');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [backendConnected, setBackendConnected] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<Account | null>(null);
  const [trafficReports, setTrafficReports] = useState<TrafficReport[]>([]);
  const [reportTtlSeconds, setReportTtlSeconds] = useState<number>(4 * 60 * 60);
  const [reportMaxDistanceKm, setReportMaxDistanceKm] = useState<number>(5);

  const yoloOverrideRef = useRef(false);
  const backendConnectedRef = useRef(false);
  const selectedIntersection = useMemo(() => {
    return intersections.find((item) => item.id === selectedIntersectionId) || intersections[0];
  }, [intersections, selectedIntersectionId]);

  const applyBackendState = useCallback((state: SimulationStatePayload) => {
    setIntersections(state.intersections);
    setKpis(state.kpis);
    if (state.performanceData?.length) {
      setPerformanceData(state.performanceData);
    }
    if (state.scenario) {
      setCurrentScenario(state.scenario);
    }
    if (state.scenarios?.length) {
      setScenarios(state.scenarios);
    }
    setIsSimulationRunning(state.status === 'running');
    if (typeof state.simulationSpeed === 'number') {
      setSimulationSpeedState(state.simulationSpeed);
    }
    if (state.settings) {
      setSettings((prev) => ({ ...prev, ...state.settings }));
    }
    if (!yoloOverrideRef.current && state.detection) {
      setDetection((prev) => ({
        ...prev,
        ...state.detection,
        confidence: state.detection.confidence || prev.confidence,
        fps: state.detection.fps || prev.fps,
        latencyMs: state.detection.latencyMs || prev.latencyMs,
      }));
    }
  }, []);

  const stateRef = useRef({
    intersections,
    kpis,
    detection,
    performanceData,
    currentScenario,
    settings,
    isSimulationRunning,
    simulationSpeed,
  });

  useEffect(() => {
    stateRef.current = {
      intersections,
      kpis,
      detection,
      performanceData,
      currentScenario,
      settings,
      isSimulationRunning,
      simulationSpeed,
    };
  }, [intersections, kpis, detection, performanceData, currentScenario, settings, isSimulationRunning, simulationSpeed]);

  useEffect(() => {
    backendConnectedRef.current = backendConnected;
  }, [backendConnected]);

  useEffect(() => {
    if (!isApiConfigured()) {
      setBackendConnected(false);
      return;
    }
    let cancelled = false;
    const connect = async () => {
      try {
        await api.health();
        const [state, reports, account] = await Promise.all([
          api.start(),
          api.trafficReports(),
          api.currentAccount(),
        ]);
        if (cancelled) return;
        setBackendConnected(true);
        setCurrentUser(account.user);
        applyBackendState(state);
        setTrafficReports(reports.reports);
        setReportTtlSeconds(reports.expiresAfterSeconds);
        setReportMaxDistanceKm(reports.maxDistanceKm);
      } catch {
        if (!cancelled) setBackendConnected(false);
      }
    };
    connect();
    return () => {
      cancelled = true;
    };
  }, [applyBackendState]);

  useEffect(() => {
    if (!backendConnected) return;
    let cancelled = false;
    const refreshReports = () => {
      api.trafficReports()
        .then((payload) => {
          if (!cancelled) {
            setTrafficReports(payload.reports);
            setReportTtlSeconds(payload.expiresAfterSeconds);
            setReportMaxDistanceKm(payload.maxDistanceKm);
          }
        })
        .catch(() => {
          if (!cancelled) setBackendConnected(false);
        });
    };
    const timer = setInterval(refreshReports, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [backendConnected]);

  useEffect(() => {
    if (!isSimulationRunning) return;

    const intervalMs = Math.max(100, Math.round(1000 / simulationSpeed));
    const timer = setInterval(async () => {
      if (backendConnectedRef.current) {
        try {
          const state = await api.state();
          applyBackendState(state);
        } catch {
          setBackendConnected(false);
        }
        return;
      }

      const {
        intersections: curInts,
        kpis: curKpis,
        detection: curDet,
        performanceData: curPerf,
        currentScenario: curScen,
        settings: curSet,
      } = stateRef.current;

      const result = runSimulationStep(
        curInts,
        curKpis,
        curDet,
        curPerf,
        curScen,
        curSet,
        1
      );

      setIntersections(result.intersections);
      setKpis(result.kpis);
      if (!yoloOverrideRef.current) {
        setDetection(result.detection);
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulationRunning, simulationSpeed, applyBackendState]);

  const selectIntersection = (id: string) => {
    setSelectedIntersectionId(id);
    const target = intersections.find((item) => item.id === id);
    if (target) {
      setDetection((prev) => ({
        ...prev,
        cameraId: target.cameraId,
        intersectionName: target.name,
      }));
    }
  };

  const startSimulation = () => {
    if (backendConnectedRef.current) {
      api.start().then(applyBackendState).catch(() => setBackendConnected(false));
      return;
    }
    setIsSimulationRunning(true);
  };

  const pauseSimulation = () => {
    if (backendConnectedRef.current) {
      api.pause().then(applyBackendState).catch(() => setBackendConnected(false));
      return;
    }
    setIsSimulationRunning(false);
  };

  const toggleSimulation = () => {
    if (isSimulationRunning) pauseSimulation();
    else startSimulation();
  };

  const resetSimulation = () => {
    yoloOverrideRef.current = false;
    if (backendConnectedRef.current) {
      api.reset().then(applyBackendState).catch(() => setBackendConnected(false));
      return;
    }
    setIsSimulationRunning(false);
    setIntersections(INITIAL_INTERSECTIONS);
    setKpis(INITIAL_KPIS);
    setDetection(INITIAL_DETECTION);
    setPerformanceData(INITIAL_PERFORMANCE_DATA);
    setSelectedIntersectionId('int-04');
  };

  const setSimulationSpeed = (speed: number) => {
    setSimulationSpeedState(speed);
    if (backendConnectedRef.current) {
      api.setSpeed(speed).then(applyBackendState).catch(() => setBackendConnected(false));
    }
  };

  const setScenario = (scenarioId: SimulationScenarioId) => {
    if (backendConnectedRef.current) {
      api.setScenario(scenarioId).then((payload) => applyBackendState(payload.state)).catch(() => setBackendConnected(false));
      return;
    }
    const target = scenarios.find((s) => s.id === scenarioId) || scenarios[0];
    setCurrentScenario(target);
  };

  const toggleControllerMode = (intersectionId: string, mode?: 'adaptive' | 'fixed') => {
    if (backendConnectedRef.current) {
      const current = intersections.find((item) => item.id === intersectionId);
      const nextMode = mode || (current?.controllerMode === 'adaptive' ? 'fixed' : 'adaptive');
      api.setMode(nextMode, intersectionId).then(applyBackendState).catch(() => setBackendConnected(false));
      return;
    }
    setIntersections((prev) =>
      prev.map((item) => {
        if (item.id === intersectionId) {
          const nextMode = mode || (item.controllerMode === 'adaptive' ? 'fixed' : 'adaptive');
          return {
            ...item,
            controllerMode: nextMode,
          };
        }
        return item;
      })
    );
  };

  const applyAiToIntersection = (intersectionId: string) => {
    if (backendConnectedRef.current) {
      api.setMode('adaptive', intersectionId).then(applyBackendState).catch(() => setBackendConnected(false));
      return;
    }
    setIntersections((prev) =>
      prev.map((item) => {
        if (item.id === intersectionId) {
          return {
            ...item,
            controllerMode: 'adaptive',
            safetyPassed: true,
          };
        }
        return item;
      })
    );
  };

  const updateSettings = (partial: Partial<SimulationSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    if (backendConnectedRef.current) {
      api.updateSettings(partial).then(applyBackendState).catch(() => setBackendConnected(false));
    }
  };

  const exportReport = () => {
    if (backendConnectedRef.current) {
      api.exportCsv()
        .then((csv) => {
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'cityflow_simulated_metrics.csv';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        })
        .catch(() => exportTrafficDataToCsv(intersections, kpis, performanceData));
      return;
    }
    exportTrafficDataToCsv(intersections, kpis, performanceData);
  };

  const analyzeUploadedVideo = async (file: File) => {
    if (!backendConnectedRef.current) return;
    try {
      const result = await api.analyzeVideo(file);
      if (result.status === 'completed' && result.countsByClass) {
        yoloOverrideRef.current = true;
        setDetection((prev) => ({
          ...prev,
          cars: result.countsByClass?.car ?? prev.cars,
          bikes: result.countsByClass?.motorcycle ?? prev.bikes,
          buses: result.countsByClass?.bus ?? prev.buses,
          trucks: result.countsByClass?.truck ?? prev.trucks,
          confidence: result.meanConfidence ? Math.round(result.meanConfidence * 1000) / 10 : prev.confidence,
        }));
      }
    } catch {
      /* Detection remains optional; simulation is unaffected. */
    }
  };

  const submitTrafficReport = async (report: TrafficReportInput) => {
    if (!backendConnectedRef.current) {
      throw new Error('Connect the Python API to submit and share traffic reports.');
    }
    if (!currentUser) {
      throw new Error('Sign in or create an account to submit a traffic report.');
    }
    const result = await api.createTrafficReport(report);
    setTrafficReports((current) => [
      result.report,
      ...current.filter((item) => item.id !== result.report.id),
    ]);
    return result.report;
  };

  const createAccount = async (profile: {
    fullName: string;
    email: string;
    phone: string;
    city: string;
    password: string;
    phoneVerificationCode: string;
  }) => {
    const result = await api.signup(profile);
    setCurrentUser(result.user);
  };

  const signIn = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setCurrentUser(result.user);
  };

  const signOut = async () => {
    await api.logout();
    setCurrentUser(null);
  };

  const decideAccidentReport = async (reportId: string, decision: 'approve' | 'reject') => {
    const result = await api.decideAccidentReport(reportId, decision);
    setTrafficReports((current) => decision === 'reject'
      ? current.filter((report) => report.id !== reportId)
      : current.map((report) => report.id === reportId ? result.report : report));
  };

  return (
    <TrafficContext.Provider
      value={{
        intersections,
        selectedIntersection,
        selectedIntersectionId,
        kpis,
        detection,
        performanceData,
        scenarios,
        currentScenario,
        currentView,
        isSimulationRunning,
        simulationSpeed,
        settings,
        mapViewMode,
        timeRange,
        sidebarCollapsed,
        backendConnected,
        currentUser,
        trafficReports,
        reportTtlSeconds,
        reportMaxDistanceKm,
        selectIntersection,
        setCurrentView,
        toggleSimulation,
        startSimulation,
        pauseSimulation,
        resetSimulation,
        setSimulationSpeed,
        setScenario,
        toggleControllerMode,
        applyAiToIntersection,
        updateSettings,
        setMapViewMode,
        setTimeRange,
        setSidebarCollapsed,
        exportReport,
        analyzeUploadedVideo,
        submitTrafficReport,
        createAccount,
        signIn,
        signOut,
        decideAccidentReport,
      }}
    >
      {children}
    </TrafficContext.Provider>
  );
};

export const useTraffic = () => {
  const context = useContext(TrafficContext);
  if (!context) {
    throw new Error('useTraffic must be used within a TrafficProvider');
  }
  return context;
};
