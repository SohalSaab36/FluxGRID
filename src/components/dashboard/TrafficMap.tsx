import React, { useState, useEffect } from 'react';
import { Layers, Maximize2, Radio, ChevronDown, Check, MessageSquarePlus } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';
import { SchematicMapView } from '../map/SchematicMapView';
import { MapLibreView } from '../map/MapLibreView';
import { TrafficReportDialog } from './TrafficReportDialog';
import { TrafficReport } from '../../types/traffic';

interface TrafficMapProps {
  intersectionIds?: string[];
}

export const TrafficMap: React.FC<TrafficMapProps> = ({ intersectionIds }) => {
  const {
    intersections,
    mapViewMode,
    setMapViewMode,
    setCurrentView,
    backendConnected,
    reportTtlSeconds,
    reportMaxDistanceKm,
    submitTrafficReport,
    currentUser,
  } = useTraffic();
  const visibleIntersections = intersectionIds
    ? intersections.filter((intersection) => intersectionIds.includes(intersection.id))
    : intersections;

  const [lastUpdatedSec, setLastUpdatedSec] = useState<number>(2);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState<boolean>(false);
  const [reportDialogOpen, setReportDialogOpen] = useState<boolean>(false);
  const [reportSuccess, setReportSuccess] = useState<string>('');

  const handleReportSubmitted = (report: TrafficReport) => {
    setReportSuccess(`Report added near ${report.intersectionCode} · ${report.intersectionName}`);
    setReportDialogOpen(false);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setLastUpdatedSec((prev) => (prev > 12 ? 1 : prev + 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 relative">
      {/* Panel Header (matches screenshot) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-cyan/10 border border-cyan/30 flex items-center justify-center text-cyan">
            <Radio className="w-3 h-3" />
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">
            Live traffic monitoring
          </span>
          <span className="text-xs text-text-muted">
            {visibleIntersections.length} intersections
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setReportSuccess('');
              setReportDialogOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-md bg-cyan px-2.5 py-1.5 text-[11px] font-semibold text-[#080F1B] transition-colors hover:bg-cyan-hover"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            Report traffic
          </button>
          {/* SIMULATION badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success-dark border border-success/30 text-success text-[10px] font-semibold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            <span>SIMULATION</span>
          </div>

          {/* Last updated indicator */}
          <span className="text-[11px] text-text-muted">
            Updated {lastUpdatedSec} s ago
          </span>

          {/* Expand map button */}
          <button
            onClick={() => setCurrentView('map')}
            className="p-1 rounded text-text-secondary hover:text-cyan hover:bg-[#152538] transition-colors"
            title="Expand to Full Map View"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Layer selector bar overlay */}
      <div className="relative">
        <div className="absolute top-2.5 left-2.5 z-10">
          <div className="relative">
            <button
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#111C2B]/95 border border-border hover:border-cyan/40 text-xs font-medium text-text-primary shadow-lg backdrop-blur-md transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-cyan" />
              <span>
                {mapViewMode === 'schematic'
                  ? 'Downtown - Traffic layer'
                  : 'Street map - Traffic layer'}
              </span>
              <ChevronDown className="w-3 h-3 text-text-muted ml-0.5" />
            </button>

            {layerDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-52 rounded-md bg-[#111C2B] border border-border shadow-2xl py-1 z-30 text-xs">
                <button
                  onClick={() => {
                    setMapViewMode('schematic');
                    setLayerDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#16273B] text-text-primary"
                >
                  <span>Downtown Digital Twin (Schematic)</span>
                  {mapViewMode === 'schematic' && <Check className="w-3.5 h-3.5 text-cyan" />}
                </button>
                <button
                  onClick={() => {
                    setMapViewMode('maplibre');
                    setLayerDropdownOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-[#16273B] text-text-primary"
                >
                  <span>Street map (Delhi GPS)</span>
                  {mapViewMode === 'maplibre' && <Check className="w-3.5 h-3.5 text-cyan" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The Map Renderer */}
        {mapViewMode === 'schematic'
          ? <SchematicMapView intersectionIds={intersectionIds} />
          : <MapLibreView intersectionIds={intersectionIds} />}
      </div>
      {reportSuccess && (
        <p role="status" className="rounded-lg border border-success/30 bg-success-dark/40 px-3 py-2 text-xs text-success">
          {reportSuccess}
        </p>
      )}
      {reportDialogOpen && (
        <TrafficReportDialog
          backendConnected={backendConnected}
          currentUser={currentUser}
          reportTtlSeconds={reportTtlSeconds}
          reportMaxDistanceKm={reportMaxDistanceKm}
          onClose={() => setReportDialogOpen(false)}
          onSubmit={submitTrafficReport}
          onSubmitted={handleReportSubmitted}
          onSignIn={() => {
            setReportDialogOpen(false);
            setCurrentView('account');
          }}
        />
      )}
    </div>
  );
};
