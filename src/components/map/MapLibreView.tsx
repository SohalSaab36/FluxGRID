import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTraffic } from '../../context/TrafficContext';
import { DELHI_CENTER } from '../../lib/demoData';
import { RoutePlan } from '../../lib/apiClient';

interface MapLibreViewProps {
  plannedRoute?: RoutePlan | null;
  selectedRouteId?: string | null;
  intersectionIds?: string[];
  containerClassName?: string;
}

interface IntersectionMarker {
  marker: maplibregl.Marker;
  element: HTMLButtonElement;
  signature: string;
  position: string;
}

export const MapLibreView: React.FC<MapLibreViewProps> = ({
  plannedRoute = null,
  selectedRouteId = null,
  intersectionIds,
  containerClassName = 'h-[320px]',
}) => {
  const {
    intersections,
    selectedIntersection,
    selectIntersection,
    setMapViewMode,
    trafficReports,
  } = useTraffic();
  const visibleIntersections = useMemo(
    () => intersectionIds
      ? intersections.filter((intersection) => intersectionIds.includes(intersection.id))
      : intersections,
    [intersections, intersectionIds],
  );
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<{ [id: string]: IntersectionMarker }>({});
  const selectIntersectionRef = useRef(selectIntersection);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [loadError, setLoadError] = useState<boolean>(false);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const reportCounts = useMemo(() => {
    const counts = new Map<string, number>();
    trafficReports.forEach((report) => {
      counts.set(report.intersectionId, (counts.get(report.intersectionId) || 0) + 1);
    });
    return counts;
  }, [trafficReports]);

  useEffect(() => {
    selectIntersectionRef.current = selectIntersection;
  }, [selectIntersection]);

  // Initialize MapLibre GL Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      setLoadError(false);
      setMapLoaded(false);
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: 'https://tiles.openfreemap.org/styles/bright',
        center: DELHI_CENTER,
        zoom: 12.5,
        attributionControl: false,
      });
      const resizeObserver = new ResizeObserver(() => map.resize());
      resizeObserver.observe(mapContainerRef.current);

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'bottom-right');
      map.addControl(new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
      map.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: '© OpenFreeMap © OpenStreetMap (Demo Sim Data)',
        }),
        'bottom-left'
      );

      const styleLoadTimeout = window.setTimeout(() => {
        if (!map.isStyleLoaded()) {
          resizeObserver.disconnect();
          mapRef.current = null;
          map.remove();
          setLoadError(true);
        }
      }, 15000);

      map.on('load', () => {
        window.clearTimeout(styleLoadTimeout);
        setMapLoaded(true);
        setLoadError(false);
      });

      map.on('error', (e) => {
        // Fallback if tile server fails
        console.warn('MapLibre tile load notice:', e);
        if (!mapLoaded) {
          // If completely failed to initialize
          // setLoadError(true);
        }
      });

      mapRef.current = map;

      return () => {
        window.clearTimeout(styleLoadTimeout);
        resizeObserver.disconnect();
        if (mapRef.current === map) {
          mapRef.current = null;
          Object.values(markersRef.current).forEach(({ marker }) => marker.remove());
          markersRef.current = {};
          popupRef.current?.remove();
          popupRef.current = null;
          map.remove();
        }
      };
    } catch (err) {
      console.error('Failed to init MapLibre:', err);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const sourceId = 'cityflow-planned-routes';
    const layerId = 'cityflow-planned-routes-line';
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
    if (!plannedRoute) return;

    const features = plannedRoute.routes.map((route) => ({
      type: 'Feature' as const,
      properties: {
        selected: route.id === selectedRouteId,
        recommended: route.id === plannedRoute.recommendedRouteId,
      },
      geometry: route.geometry,
    }));
    map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
    });
    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': [
          'case',
          ['boolean', ['get', 'selected'], false],
          '#31D7E8',
          ['boolean', ['get', 'recommended'], false],
          '#F4B84A',
          '#70839B',
        ],
        'line-width': ['case', ['boolean', ['get', 'selected'], false], 7, 4],
        'line-opacity': ['case', ['boolean', ['get', 'selected'], false], 0.95, 0.65],
      },
    });

    const selectedRoute = plannedRoute.routes.find((route) => route.id === selectedRouteId);
    if (selectedRoute) {
      const bounds = new maplibregl.LngLatBounds();
      selectedRoute.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));
      map.fitBounds(bounds, { padding: 70, maxZoom: 14, duration: 700 });
    }
  }, [mapLoaded, plannedRoute, selectedRouteId]);

  // Add / Update Intersection Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const visibleIds = new Set(visibleIntersections.map((item) => item.id));
    Object.entries(markersRef.current).forEach(([id, entry]) => {
      if (!visibleIds.has(id)) {
        entry.marker.remove();
        delete markersRef.current[id];
      }
    });

    visibleIntersections.forEach((item) => {
      const color =
        item.congestion === 'heavy'
          ? '#FF647C'
          : item.congestion === 'moderate'
          ? '#F4B84A'
          : '#39D9A5';

      const isSelected = item.id === selectedIntersection.id;
      const reportCount = reportCounts.get(item.id) || 0;
      const position = item.coordinates.join(',');
      const signature = `${item.congestion}:${isSelected}:${reportCount}`;
      const existing = markersRef.current[item.id];
      if (existing) {
        if (existing.signature !== signature) {
          existing.element.innerHTML = markerContent(color, isSelected, reportCount);
          existing.element.setAttribute(
            'aria-label',
            `${item.name}, ${item.congestion} traffic${reportCount ? `, ${reportCount} active reports` : ''}`,
          );
          existing.element.setAttribute('aria-pressed', String(isSelected));
          existing.signature = signature;
        }
        if (existing.position !== position) {
          existing.marker.setLngLat(item.coordinates);
          existing.position = position;
        }
        return;
      }

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'traffic-marker cursor-pointer border-0 bg-transparent p-0 transition-transform hover:scale-125';
      el.setAttribute('aria-label', `${item.name}, ${item.congestion} traffic${reportCount ? `, ${reportCount} active reports` : ''}`);
      el.setAttribute('aria-pressed', String(isSelected));
      el.style.cursor = 'pointer';
      el.style.padding = '8px';
      el.style.touchAction = 'manipulation';
      el.style.outlineOffset = '2px';
      el.innerHTML = markerContent(color, isSelected, reportCount);

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        selectIntersectionRef.current(item.id);
      });

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(item.coordinates)
        .addTo(map);

      markersRef.current[item.id] = { marker, element: el, signature, position };
    });
  }, [mapLoaded, visibleIntersections, selectedIntersection.id, reportCounts]);

  // Keep the popup current without repeatedly animating the map as simulation data refreshes.
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedIntersection) return;

    const color =
      selectedIntersection.congestion === 'heavy'
        ? '#FF647C'
        : selectedIntersection.congestion === 'moderate'
        ? '#F4B84A'
        : '#39D9A5';

    const popupHtml = `
      <div style="font-family: Inter, sans-serif; min-width: 170px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid #243449; padding-bottom: 4px;">
          <strong style="color: #E6EDF7; font-size: 11px;">${selectedIntersection.code} · ${selectedIntersection.name}</strong>
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${color};"></span>
        </div>
        <div style="color: #8192A9; font-size: 10px; margin: 6px 0;">
          Status: <strong style="color:${color}; text-transform:capitalize;">${selectedIntersection.congestion}</strong><br/>
          Queue: ${selectedIntersection.queueLength} vehicles<br/>
          Signal: ${selectedIntersection.currentPhase} (${selectedIntersection.phaseRemainingSeconds}s)
        </div>
        <div style="background: rgba(49,215,232,0.1); border: 1px solid rgba(49,215,232,0.3); border-radius: 4px; padding: 4px 6px; color: #31D7E8; font-size: 9px; font-weight:600;">
          ⚡ ${selectedIntersection.aiRecommendation}
        </div>
      </div>
    `;

    if (!popupRef.current) {
      popupRef.current = new maplibregl.Popup({ offset: 18, closeButton: true });
    }
    popupRef.current
      .setLngLat(selectedIntersection.coordinates)
      .setHTML(popupHtml)
      .addTo(mapRef.current);
  }, [mapLoaded, selectedIntersection]);

  // Recenter only when the selected intersection changes, not on every simulation tick.
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !selectedIntersection) return;
    const map = mapRef.current;
    map.flyTo({
      center: selectedIntersection.coordinates,
      zoom: Math.max(map.getZoom(), 13),
      duration: 800,
      essential: true,
    });
  }, [mapLoaded, selectedIntersection.id]);

  if (loadError) {
    return (
      <div className={`w-full ${containerClassName} bg-[#0A1320] rounded-lg border border-border flex flex-col items-center justify-center p-6 text-center`}>
        <span className="text-warning text-xs font-semibold mb-1">OpenFreeMap Offline Fallback</span>
        <p className="text-[11px] text-text-secondary max-w-sm mb-3">
          The street map could not load. Switch to the local digital twin map to keep viewing traffic.
        </p>
        <button
          type="button"
          onClick={() => setMapViewMode('schematic')}
          className="rounded-lg border border-cyan/40 px-3 py-2 text-xs font-semibold text-cyan hover:bg-cyan/10"
        >
          Open digital twin map
        </button>
      </div>
    );
  }

  return (
    <div className={`relative w-full ${containerClassName} rounded-lg overflow-hidden border border-border`}>
      <div ref={mapContainerRef} className="w-full h-full" />
      {/* Delhi Demo Location Tag */}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[#0E1726]/90 border border-border text-[10px] text-text-secondary backdrop-blur pointer-events-none">
        OpenStreetMap · Delhi NCR demo corridor
      </div>
      {!mapLoaded && (
        <div role="status" className="absolute inset-0 flex items-center justify-center bg-[#0A1320]/70 text-xs text-text-secondary">
          Loading street map…
        </div>
      )}
    </div>
  );
};

function markerContent(color: string, isSelected: boolean, reportCount: number): string {
  const size = isSelected ? 22 : 16;
  const reportBadge = reportCount > 0
    ? `<span style="position:absolute;top:-8px;right:-8px;min-width:14px;height:14px;padding:0 3px;border-radius:8px;background:#F4B84A;color:#080F1B;font:bold 9px Inter,sans-serif;display:flex;align-items:center;justify-content:center;">${reportCount > 9 ? '9+' : reportCount}</span>`
    : '';
  return `<span style="position:relative;display:flex;width:${size}px;height:${size}px;align-items:center;justify-content:center;background:#0B1524;border:3px solid ${color};border-radius:50%;box-shadow:0 0 10px ${color}88;"><span style="width:4px;height:4px;background:${isSelected ? '#31D7E8' : color};border-radius:50%;"></span></span>${reportBadge}`;
}
