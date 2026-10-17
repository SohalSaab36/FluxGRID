import React, { useState, useEffect } from 'react';
import { PanelLeft, Clock, Bell } from 'lucide-react';
import { useTraffic } from '../../context/TrafficContext';

export const Header: React.FC = () => {
  const { currentView, setSidebarCollapsed, backendConnected, currentUser, setCurrentView } = useTraffic();
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const minutes = String(now.getUTCMinutes()).padStart(2, '0');
      const seconds = String(now.getUTCSeconds()).padStart(2, '0');
      setUtcTime(`${hours}:${minutes}:${seconds} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const viewTitles: Record<string, string> = {
    overview: 'Overview',
    map: 'Live Traffic Map',
    intersections: 'Intersection Control',
    detection: 'AI Vehicle Detection',
    analytics: 'Performance Analytics',
    simulation: 'Simulation Lab',
    settings: 'Settings',
    account: 'Account',
    admin: 'Accident Approvals',
  };

  return (
    <header className="h-12 bg-bg-dark border-b border-border px-4 flex items-center justify-between shrink-0 select-none">
      {/* Left: Breadcrumbs & Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarCollapsed((prev) => !prev)}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-[#111C2B] transition-colors"
          title="Toggle sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-text-muted">Operations centre</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-primary font-medium">{viewTitles[currentView] || 'Overview'}</span>
        </div>
      </div>

      {/* Right: Badges, Time, Notifications, Profile */}
      <div className="flex items-center gap-3">
        <div
          title={backendConnected
            ? 'Traffic data is connected to the Python simulation API.'
            : 'Traffic data is running in the built-in browser simulation.'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide ${
            backendConnected
              ? 'bg-success-dark border-success/30 text-success'
              : 'bg-[#0E1726] border-border text-text-secondary'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-success' : 'bg-text-muted'}`} />
          <span>{backendConnected ? 'PYTHON API' : 'LOCAL SIMULATION'}</span>
        </div>

        {/* DEMO MODE Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0E2433] border border-cyan/30 text-cyan text-xs font-semibold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
          <span>DEMO MODE</span>
        </div>

        {/* UTC Clock */}
        <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
          <Clock className="w-3.5 h-3.5 text-text-muted" />
          <span>{utcTime || '17:45:00 UTC'}</span>
        </div>

        {/* Notifications */}
        <button
          className="relative p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-[#111C2B] transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-cyan" />
        </button>

        {/* User Avatar */}
        <button
          onClick={() => setCurrentView('account')}
          title={currentUser ? `${currentUser.email} (${currentUser.role})` : 'Sign in'}
          className="w-7 h-7 rounded-full bg-[#1A2A3D] border border-border flex items-center justify-center text-xs font-medium text-text-primary hover:border-cyan/50 transition-colors"
        >
          <span>{currentUser?.email.slice(0, 2).toUpperCase() || 'AK'}</span>
        </button>
      </div>
    </header>
  );
};
