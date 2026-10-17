import React, { useMemo, useState } from 'react';
import { Sparkles, Compass } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';
import { Intersection } from '../../types/traffic';

interface SchematicMapViewProps {
  intersectionIds?: string[];
  containerClassName?: string;
}

export const SchematicMapView: React.FC<SchematicMapViewProps> = ({
  intersectionIds,
  containerClassName = 'h-[320px]',
}) => {
  const { intersections, selectedIntersection, selectIntersection, trafficReports } = useTraffic();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const visibleIntersections = useMemo(
    () => intersectionIds
      ? intersections.filter((intersection) => intersectionIds.includes(intersection.id))
      : intersections,
    [intersections, intersectionIds],
  );
  const reportCounts = useMemo(() => {
    const counts = new Map<string, number>();
    trafficReports.forEach((report) => {
      counts.set(report.intersectionId, (counts.get(report.intersectionId) || 0) + 1);
    });
    return counts;
  }, [trafficReports]);

  // Position nodes onto a 4-column x 3-row grid corresponding to J01-J12
  // Row 0: Oak Street (J01, J02, J03)
  // Row 1: Central Avenue (J05, J04, J06, J11)
  // Row 2: Riverside Drive (J07, J08, J09, J10, J12)
  const nodePositions: Record<string, { x: number; y: number; label: string }> = {
    'int-01': { x: 120, y: 70, label: 'J01' },
    'int-02': { x: 260, y: 70, label: 'J02' },
    'int-03': { x: 420, y: 70, label: 'J03' },
    'int-05': { x: 260, y: 155, label: 'J05' },
    'int-04': { x: 420, y: 155, label: 'J04' },
    'int-06': { x: 580, y: 155, label: 'J06' },
    'int-07': { x: 120, y: 245, label: 'J07' },
    'int-08': { x: 260, y: 245, label: 'J08' },
    'int-09': { x: 420, y: 245, label: 'J09' },
    'int-10': { x: 580, y: 245, label: 'J10' },
    'int-11': { x: 580, y: 70, label: 'J11' },
    'int-12': { x: 670, y: 200, label: 'J12' },
  };

  const getStatusColor = (congestion: string) => {
    switch (congestion) {
      case 'heavy':
        return '#FF647C';
      case 'moderate':
        return '#F4B84A';
      default:
        return '#39D9A5';
    }
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(1.5, Math.max(0.8, prev + delta)));
  };

  return (
    <div className={`relative w-full ${containerClassName} bg-[#0A1320] rounded-lg overflow-hidden border border-border select-none flex items-center justify-center`}>
      {/* SVG Background Schematic Grid */}
      <div
        className="w-full h-full transition-transform duration-300 relative flex items-center justify-center"
        style={{ transform: `scale(${zoomLevel})` }}
      >
        <svg
          viewBox="0 0 740 310"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* City blocks (dark rounded rectangles matching screenshot) */}
          <g fill="#111B29" stroke="#18273A" strokeWidth="1">
            {/* Row 1 Blocks */}
            <rect x="30" y="20" width="70" height="35" rx="3" />
            <rect x="140" y="20" width="100" height="35" rx="3" />
            <rect x="280" y="20" width="120" height="35" rx="3" />
            <rect x="440" y="20" width="120" height="35" rx="3" />
            <rect x="600" y="20" width="70" height="35" rx="3" />

            {/* Row 2 Blocks */}
            <rect x="30" y="90" width="70" height="48" rx="3" />
            <rect x="140" y="90" width="100" height="48" rx="3" />
            <rect x="280" y="90" width="120" height="48" rx="3" />
            <rect x="440" y="90" width="120" height="48" rx="3" />
            <rect x="600" y="90" width="70" height="48" rx="3" />

            {/* Row 3 Blocks */}
            <rect x="30" y="175" width="70" height="52" rx="3" />
            <rect x="140" y="175" width="100" height="52" rx="3" />
            <rect x="280" y="175" width="120" height="52" rx="3" />
            <rect x="440" y="175" width="120" height="52" rx="3" />
            <rect x="600" y="175" width="70" height="52" rx="3" />

            {/* Bottom Row Blocks */}
            <rect x="30" y="260" width="70" height="35" rx="3" />
            <rect x="140" y="260" width="100" height="35" rx="3" />
            <rect x="280" y="260" width="120" height="35" rx="3" />
            <rect x="440" y="260" width="120" height="35" rx="3" />
            <rect x="600" y="260" width="70" height="35" rx="3" />
          </g>

          {/* Street Name Labels */}
          <text x="35" y="74" fill="#3D4F66" fontSize="8" fontFamily="Inter" fontWeight="600" letterSpacing="0.5">OAK STREET</text>
          <text x="445" y="160" fill="#3D4F66" fontSize="8" fontFamily="Inter" fontWeight="600" letterSpacing="0.5">CENTRAL AVENUE</text>
          <text x="285" y="250" fill="#3D4F66" fontSize="8" fontFamily="Inter" fontWeight="600" letterSpacing="0.5">RIVERSIDE DRIVE</text>
          <text x="450" y="95" fill="#3D4F66" fontSize="7.5" fontFamily="Inter" fontWeight="600" letterSpacing="0.5">CIVIC GARDENS</text>

          {/* Arterial Corridors (Flow lines) */}
          {/* Horizontal Oak Street */}
          <line x1="20" y1="70" x2="680" y2="70" stroke="#1F3249" strokeWidth="4" />
          <line x1="120" y1="70" x2="260" y2="70" stroke="#F4B84A" strokeWidth="2.5" strokeOpacity="0.85" />
          <line x1="260" y1="70" x2="420" y2="70" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.85" />
          <line x1="420" y1="70" x2="580" y2="70" stroke="#FF647C" strokeWidth="2.5" strokeOpacity="0.85" />

          {/* Horizontal Central Avenue */}
          <line x1="20" y1="155" x2="680" y2="155" stroke="#1F3249" strokeWidth="5" />
          <line x1="120" y1="155" x2="260" y2="155" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.85" />
          <line x1="260" y1="155" x2="420" y2="155" stroke="#FF647C" strokeWidth="3" strokeOpacity="0.9" />
          <line x1="420" y1="155" x2="580" y2="155" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.85" />

          {/* Horizontal Riverside Drive */}
          <line x1="20" y1="245" x2="680" y2="245" stroke="#1F3249" strokeWidth="4" />
          <line x1="120" y1="245" x2="260" y2="245" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.85" />
          <line x1="260" y1="245" x2="420" y2="245" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.85" />
          <line x1="420" y1="245" x2="580" y2="245" stroke="#F4B84A" strokeWidth="2.5" strokeOpacity="0.85" />

          {/* Vertical Corridors */}
          <line x1="120" y1="20" x2="120" y2="290" stroke="#1F3249" strokeWidth="4" />
          <line x1="260" y1="20" x2="260" y2="290" stroke="#1F3249" strokeWidth="4" />
          <line x1="420" y1="20" x2="420" y2="290" stroke="#1F3249" strokeWidth="4" />
          <line x1="580" y1="20" x2="580" y2="290" stroke="#1F3249" strokeWidth="4" />

          {/* Vertical flow segments */}
          <line x1="420" y1="70" x2="420" y2="155" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.9" />
          <line x1="420" y1="155" x2="420" y2="245" stroke="#39D9A5" strokeWidth="2.5" strokeOpacity="0.9" />
          <line x1="580" y1="70" x2="580" y2="155" stroke="#FF647C" strokeWidth="2.5" strokeOpacity="0.85" />

          {/* Intersection Nodes */}
          {visibleIntersections.map((node) => {
            const pos = nodePositions[node.id] || { x: 300, y: 150, label: node.code };
            const isSelected = selectedIntersection.id === node.id;
            const color = getStatusColor(node.congestion);
            const reportCount = reportCounts.get(node.id) || 0;

            return (
              <g
                key={node.id}
                className="cursor-pointer transition-transform hover:scale-125"
                onClick={() => selectIntersection(node.id)}
                aria-label={`${node.name}, ${node.congestion} traffic${reportCount ? `, ${reportCount} active reports` : ''}`}
              >
                {/* Outer Glow on Selected */}
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="12"
                    fill="none"
                    stroke="#31D7E8"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                    className="animate-spin"
                    style={{ transformOrigin: `${pos.x}px ${pos.y}px`, animationDuration: '6s' }}
                  />
                )}
                {/* Node Ring */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="6.5"
                  fill="#0B1524"
                  stroke={color}
                  strokeWidth="2.5"
                />
                {/* Inner Center Dot */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r="2"
                  fill={isSelected ? '#31D7E8' : color}
                />
                {reportCount > 0 && (
                  <g>
                    <circle cx={pos.x + 9} cy={pos.y - 8} r="7" fill="#F4B84A" stroke="#0B1524" strokeWidth="1.5" />
                    <text
                      x={pos.x + 9}
                      y={pos.y - 5.5}
                      textAnchor="middle"
                      fill="#080F1B"
                      fontSize="7"
                      fontWeight="700"
                    >
                      {reportCount > 9 ? '9+' : reportCount}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selected Intersection Floating Popup (matching screenshot J04 exactly) */}
        {selectedIntersection && nodePositions[selectedIntersection.id] && (
          <div
            className="absolute z-20 pointer-events-none transition-all duration-300"
            style={{
              left: `${(nodePositions[selectedIntersection.id].x / 740) * 100}%`,
              top: `${(nodePositions[selectedIntersection.id].y / 310) * 100}%`,
              transform: 'translate(-50%, -125%)',
            }}
          >
            <div className="bg-[#111C2B]/95 backdrop-blur-md border border-[#243449] rounded-lg p-2.5 shadow-2xl min-w-[190px] text-xs pointer-events-auto">
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/40">
                <span className="font-semibold text-text-primary text-[11px] truncate">
                  {selectedIntersection.code} · {selectedIntersection.name}
                </span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: getStatusColor(selectedIntersection.congestion) }}
                />
              </div>

              <div className="py-1 text-[10px] text-text-secondary">
                <span className="capitalize">{selectedIntersection.congestion}</span> ·{' '}
                {selectedIntersection.queueLength} vehicles in queue
              </div>

              <div className="mt-1 flex items-center gap-1.5 px-2 py-1 rounded bg-cyan-dark/60 border border-cyan/30 text-cyan text-[10px] font-medium">
                <Sparkles className="w-3 h-3 shrink-0" />
                <span className="truncate">Green extension +12 s</span>
              </div>
            </div>
            {/* Tooltip Triangle Pointer */}
            <div className="w-2.5 h-2.5 bg-[#111C2B] border-r border-b border-[#243449] transform rotate-45 mx-auto -mt-1.5" />
          </div>
        )}
      </div>

      {/* Map Compass (Top Right) */}
      <button
        onClick={() => setZoomLevel(1)}
        className="absolute top-3 right-3 p-1.5 rounded-md bg-[#111C2B]/90 border border-border text-text-secondary hover:text-text-primary hover:border-cyan/40 transition-colors shadow"
        title="Reset orientation"
      >
        <Compass className="w-3.5 h-3.5" />
      </button>

      {/* Map Zoom Controls (+ / - Bottom Right) */}
      <div className="absolute bottom-3 right-3 flex flex-col rounded-md bg-[#111C2B]/90 border border-border overflow-hidden shadow">
        <button
          onClick={() => handleZoom(0.15)}
          className="px-2 py-1 text-xs text-text-secondary hover:text-cyan hover:bg-[#152538] border-b border-border/50 font-mono transition-colors"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={() => handleZoom(-0.15)}
          className="px-2 py-1 text-xs text-text-secondary hover:text-cyan hover:bg-[#152538] font-mono transition-colors"
          title="Zoom out"
        >
          –
        </button>
      </div>

      {/* Congestion Legend (Bottom Left) */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 px-2.5 py-1 rounded-md bg-[#0E1726]/90 border border-border text-[11px] text-text-secondary backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success" />
          <span>Clear</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning" />
          <span>Moderate</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-danger" />
          <span>Heavy</span>
        </div>
      </div>
    </div>
  );
};
