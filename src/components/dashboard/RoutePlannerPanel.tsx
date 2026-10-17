import React, { useEffect, useState } from 'react';
import { ArrowDownUp, Clock3, MapPinned, Route as RouteIcon, Sparkles } from 'lucide-react';
import { api, PlannedRoute, RoutePlan, RoutePlace } from '../../lib/apiClient';

interface RoutePlannerPanelProps {
  backendConnected: boolean;
  onPlanChange: (plan: RoutePlan | null, selectedRouteId: string | null) => void;
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

function riskStyle(label: string): string {
  if (label === 'high') return 'text-danger border-danger/30 bg-danger-dark/60';
  if (label === 'moderate') return 'text-warning border-warning/30 bg-warning-dark/60';
  if (label === 'low') return 'text-success border-success/30 bg-success-dark/60';
  return 'text-text-muted border-border bg-[#0E1726]';
}

export const RoutePlannerPanel: React.FC<RoutePlannerPanelProps> = ({
  backendConnected,
  onPlanChange,
}) => {
  const [places, setPlaces] = useState<RoutePlace[]>([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [originId, setOriginId] = useState('gtbit');
  const [destinationId, setDestinationId] = useState('connaught-place');
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!backendConnected) {
      setIsLoadingPlaces(false);
      return;
    }
    let cancelled = false;
    setIsLoadingPlaces(true);
    api.routingPlaces()
      .then((response) => {
        if (cancelled) return;
        setPlaces(response.places);
        setErrorMessage('');
        const availableIds = new Set(response.places.map((place) => place.id));
        const defaultOrigin = availableIds.has('gtbit') ? 'gtbit' : response.places[0]?.id;
        const defaultDestination = availableIds.has('connaught-place')
          ? 'connaught-place'
          : response.places.find((place) => place.id !== defaultOrigin)?.id ?? defaultOrigin;
        if (defaultOrigin) setOriginId((current) => availableIds.has(current) ? current : defaultOrigin);
        if (defaultDestination) {
          setDestinationId((current) => availableIds.has(current) ? current : defaultDestination);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : 'Could not load route locations.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPlaces(false);
      });
    return () => {
      cancelled = true;
    };
  }, [backendConnected]);

  const updateSelection = (nextPlan: RoutePlan | null, routeId: string | null) => {
    setPlan(nextPlan);
    setSelectedRouteId(routeId);
    onPlanChange(nextPlan, routeId);
  };

  const planRoute = async () => {
    setIsLoading(true);
    setErrorMessage('');
    updateSelection(null, null);
    try {
      const result = await api.planRoute(originId, destinationId);
      const selectedId = result.recommendedRouteId;
      updateSelection(result, selectedId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not calculate this route.');
    } finally {
      setIsLoading(false);
    }
  };

  const swapPlaces = () => {
    setOriginId(destinationId);
    setDestinationId(originId);
    updateSelection(null, null);
    setErrorMessage('');
  };

  const selectRoute = (route: PlannedRoute) => {
    setSelectedRouteId(route.id);
    onPlanChange(plan, route.id);
  };

  return (
    <section className="rounded-xl bg-bg-panel border border-border p-4">
      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <RouteIcon className="w-4 h-4 text-cyan" />
            <h2 className="text-sm font-semibold text-text-primary">AI route planner</h2>
          </div>
          <p className="text-[11px] text-text-muted mt-1">
            OpenStreetMap road routing + CityFlow congestion estimates
          </p>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 mt-3">
            <label className="min-w-0 text-[10px] text-text-muted">
              FROM
              <select
                value={originId}
                onChange={(event) => {
                  setOriginId(event.target.value);
                  setErrorMessage('');
                  updateSelection(null, null);
                }}
                disabled={!backendConnected || isLoadingPlaces || places.length === 0 || isLoading}
                className="block w-full mt-1 rounded-lg bg-[#0E1726] border border-border px-2.5 py-2 text-xs text-text-primary disabled:opacity-50"
              >
                {isLoadingPlaces && <option value="">Loading locations…</option>}
                {!isLoadingPlaces && places.length === 0 && <option value="">No locations available</option>}
                {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
            <button
              onClick={swapPlaces}
              disabled={!backendConnected || isLoading}
              aria-label="Swap route locations"
              className="mb-0.5 rounded-md border border-border p-2 text-text-secondary hover:text-cyan disabled:opacity-50"
            >
              <ArrowDownUp className="w-3.5 h-3.5" />
            </button>
            <label className="min-w-0 text-[10px] text-text-muted">
              TO
              <select
                value={destinationId}
                onChange={(event) => {
                  setDestinationId(event.target.value);
                  setErrorMessage('');
                  updateSelection(null, null);
                }}
                disabled={!backendConnected || isLoadingPlaces || places.length === 0 || isLoading}
                className="block w-full mt-1 rounded-lg bg-[#0E1726] border border-border px-2.5 py-2 text-xs text-text-primary disabled:opacity-50"
              >
                {isLoadingPlaces && <option value="">Loading locations…</option>}
                {!isLoadingPlaces && places.length === 0 && <option value="">No locations available</option>}
                {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
          </div>

          <button
            onClick={planRoute}
            disabled={!backendConnected || !places.length || isLoading || originId === destinationId}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-cyan px-3.5 py-2 text-xs font-semibold text-[#080F1B] hover:bg-cyan-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {isLoading ? 'Finding routes…' : 'Find best route'}
          </button>
          {!backendConnected && (
            <p className="mt-2 text-[11px] text-warning">Connect the Python API to use route planning.</p>
          )}
          {backendConnected && isLoadingPlaces && (
            <p role="status" className="mt-2 text-[11px] text-text-muted">Loading route locations…</p>
          )}
          {backendConnected && !isLoadingPlaces && places.length === 0 && !errorMessage && (
            <p role="alert" className="mt-2 text-[11px] text-warning">No route locations are configured.</p>
          )}
        </div>

        {plan && (
          <div className="w-full xl:max-w-[58%] space-y-2">
            {plan.routes.map((route, index) => {
              const recommended = route.id === plan.recommendedRouteId;
              const selected = route.id === selectedRouteId;
              return (
                <button
                  key={route.id}
                  onClick={() => selectRoute(route)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected ? 'border-cyan bg-cyan/5' : 'border-border bg-[#0E1726] hover:border-cyan/40'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs font-semibold text-text-primary">
                      <MapPinned className="w-3.5 h-3.5 text-cyan" />
                      Route {index + 1}
                      {recommended && (
                        <span className="rounded-full border border-success/30 bg-success-dark/60 px-2 py-0.5 text-[9px] uppercase tracking-wide text-success">
                          CityFlow pick
                        </span>
                      )}
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${riskStyle(route.riskLabel)}`}>
                      {route.riskLabel} risk
                    </span>
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-secondary">
                    <span className="font-mono text-text-primary">
                      {formatDuration(route.estimatedDurationSeconds)}
                    </span>
                    <span>{route.distanceKm} km</span>
                    {route.congestionScore !== null && <span>Traffic estimate {route.congestionScore}/100</span>}
                    {route.activeReports > 0 && <span>{route.activeReports} unverified report(s)</span>}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-text-muted">
                    <Clock3 className="w-3 h-3" />
                    Typical route time {formatDuration(route.baseDurationSeconds)}
                    {route.matchedIntersections.length > 0
                      ? ` · ${route.matchedIntersections.length} modeled intersection(s)`
                      : ' · regional demo estimate, no local intersections'}
                  </span>
                </button>
              );
            })}
            <p className="text-[10px] leading-relaxed text-text-muted">{plan.trafficDataNote}</p>
          </div>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-dark/40 px-3 py-2 text-xs text-danger">
          {errorMessage}
        </p>
      )}
      <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
        Trip locations are sent to the public OSRM routing service. Routes use OpenStreetMap roads and typical travel times; congestion is estimated from this demo’s simulation and unverified community reports, not live traffic speeds.
      </p>
    </section>
  );
};
