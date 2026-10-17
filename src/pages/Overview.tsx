import React, { useState } from 'react';
import { MapPin, Download, Check } from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { KpiCards } from '../components/dashboard/KpiCards';
import { TrafficMap } from '../components/dashboard/TrafficMap';
import { VehicleDetectionPanel } from '../components/dashboard/VehicleDetectionPanel';
import { SignalControlPanel } from '../components/dashboard/SignalControlPanel';
import { PerformancePanel } from '../components/dashboard/PerformancePanel';

const districts = [
  {
    name: 'Downtown district',
    intersectionIds: ['int-01', 'int-02', 'int-03', 'int-04', 'int-05', 'int-06'],
  },
  {
    name: 'Connaught Place Corridor',
    intersectionIds: ['int-04', 'int-05', 'int-06', 'int-11', 'int-12'],
  },
  {
    name: 'Riverside Expressway',
    intersectionIds: ['int-07', 'int-08', 'int-09', 'int-10'],
  },
  {
    name: 'Civic Center North',
    intersectionIds: ['int-11', 'int-12'],
  },
];

export const Overview: React.FC = () => {
  const {
    exportReport,
    intersections,
    selectIntersection,
    selectedIntersectionId,
  } = useTraffic();
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState<boolean>(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Downtown district');
  const [exported, setExported] = useState<boolean>(false);

  const activeDistrict = districts.find((district) => district.name === selectedDistrict) || districts[0];
  const districtIntersections = intersections.filter((intersection) =>
    activeDistrict.intersectionIds.includes(intersection.id),
  );
  const visibleIntersectionIds = districtIntersections.map((intersection) => intersection.id);

  const handleExport = () => {
    exportReport();
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-5 gap-4 overflow-y-auto">
      {/* Page Heading & Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-text-primary tracking-tight">
            City in motion. Signals in sync.
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Network overview · {selectedDistrict} · {districtIntersections.length} of {intersections.length} intersections
          </p>
        </div>

        {/* Top Right Buttons */}
        <div className="flex items-center gap-2.5">
          {/* District Selector */}
          <div className="relative">
            <button
              onClick={() => setDistrictDropdownOpen(!districtDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#142233] border border-border hover:border-cyan/40 text-xs font-medium text-text-primary transition-colors shadow-sm"
            >
              <MapPin className="w-3.5 h-3.5 text-text-secondary" />
              <span>{selectedDistrict}</span>
            </button>

            {districtDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg bg-[#111C2B] border border-border shadow-2xl py-1 z-30 text-xs">
                {districts.map((d) => (
                  <button
                    key={d.name}
                    onClick={() => {
                      setSelectedDistrict(d.name);
                      setDistrictDropdownOpen(false);
                      if (!d.intersectionIds.includes(selectedIntersectionId)) {
                        const firstAvailable = intersections.find((intersection) =>
                          d.intersectionIds.includes(intersection.id),
                        );
                        if (firstAvailable) selectIntersection(firstAvailable.id);
                      }
                    }}
                    aria-pressed={selectedDistrict === d.name}
                    className={`w-full text-left px-3 py-1.5 hover:bg-[#152538] ${
                      selectedDistrict === d.name ? 'text-cyan' : 'text-text-primary'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      {d.name}
                      <span className="ml-3 text-[10px] text-text-muted">
                        {d.intersectionIds.filter((id) => intersections.some((intersection) => intersection.id === id)).length}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Export Report Button */}
          <button
            onClick={handleExport}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-sm ${
              exported
                ? 'bg-success/20 border-success text-success'
                : 'bg-[#142233] border-border hover:border-cyan/40 text-text-primary hover:text-cyan'
            }`}
          >
            {exported ? <Check className="w-3.5 h-3.5 text-success" /> : <Download className="w-3.5 h-3.5" />}
            <span>{exported ? 'Report Exported' : 'Export report'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards (Row 1) */}
      <KpiCards intersections={districtIntersections} />

      {/* Central Row: Live Traffic Map (2/3 width) + AI Vehicle Detection (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8">
          <TrafficMap intersectionIds={visibleIntersectionIds} />
        </div>
        <div className="lg:col-span-4">
          <VehicleDetectionPanel />
        </div>
      </div>

      {/* Bottom Row: Adaptive Signal Control + Performance Impact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SignalControlPanel />
        <PerformancePanel />
      </div>

      {/* Bottom Footer Notice (matches screenshot) */}
      <div className="pt-2 pb-1 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between text-[11px] text-text-muted gap-2">
        <span>Demo environment - Illustrative simulation data, not live city measurements</span>
        <span>Smart City & Mobility / Team EchoBYTE</span>
      </div>
    </div>
  );
};
