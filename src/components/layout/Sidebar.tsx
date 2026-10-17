import React from 'react';
import {
  LayoutGrid,
  Map as MapIcon,
  SlidersHorizontal,
  Scan,
  TrendingUp,
  FlaskConical,
  Settings as SettingsIcon,
  UserRound,
  ShieldCheck,
} from 'lucide-react';
import { useTraffic, DashboardView } from '../../context/TrafficContext';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    isSimulationRunning,
    currentScenario,
    sidebarCollapsed,
    currentUser,
  } = useTraffic();

  const navItems: { id: DashboardView; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'map', label: 'Live Traffic Map', icon: MapIcon },
    { id: 'intersections', label: 'Intersection Control', icon: SlidersHorizontal },
    { id: 'detection', label: 'AI Vehicle Detection', icon: Scan },
    { id: 'analytics', label: 'Performance Analytics', icon: TrendingUp },
    { id: 'simulation', label: 'Simulation Lab', icon: FlaskConical },
    { id: 'account', label: currentUser ? 'My Account' : 'Sign in / Sign up', icon: UserRound },
    ...(currentUser?.role === 'admin'
      ? [{ id: 'admin' as DashboardView, label: 'Accident Approvals', icon: ShieldCheck }]
      : []),
  ];

  return (
    <aside
      className={`bg-bg-sidebar border-r border-border flex min-h-0 flex-col justify-between shrink-0 overflow-y-auto overscroll-y-contain transition-all duration-300 select-none z-30 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      } h-full`}
    >
      {/* Top Branding & Navigation */}
      <div className="flex flex-col">
        {/* Brand Header */}
        <div className="h-14 flex items-center px-4 border-b border-border/50 gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan/10 border border-cyan/30 flex items-center justify-center shrink-0 shadow-sm">
            {/* FluxGRID Geometric Logo */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 text-cyan stroke-current" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="font-semibold text-base text-text-primary tracking-tight">FluxGRID</span>
            </div>
          )}
        </div>

        {/* Workspace Label */}
        {!sidebarCollapsed && (
          <div className="px-5 pt-4 pb-2">
            <span className="text-[10px] font-semibold tracking-wider text-text-muted uppercase">
              WORKSPACE
            </span>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="px-3 space-y-1 mt-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                title={item.label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                  isActive
                    ? 'bg-[#152538] text-cyan font-semibold border-l-2 border-cyan shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#111C2B]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-cyan' : 'text-text-secondary group-hover:text-text-primary'
                  }`}
                />
                {!sidebarCollapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!sidebarCollapsed && isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan shrink-0" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Status Card & Identity */}
      <div className="p-3 space-y-3">
        {/* Simulation Status Card (matches screenshot) */}
        {!sidebarCollapsed ? (
          <div className="rounded-lg bg-[#0E1726] border border-border p-3 space-y-1.5 text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSimulationRunning ? 'bg-success animate-pulse' : 'bg-warning'
                }`}
              />
              <span className="text-xs font-medium text-text-primary">
                {isSimulationRunning ? 'Simulation running' : 'Simulation paused'}
              </span>
            </div>
            <div className="text-[11px] text-text-secondary leading-tight">
              {currentScenario.name}
            </div>
            <div className="text-[11px] text-text-muted leading-tight">
              {currentScenario.code}
            </div>
            <div className="pt-1.5 flex items-center justify-between border-t border-border/40 text-[10px] text-text-muted">
              <span>AI ENGINE v2.4</span>
              <span className="px-1.5 py-0.5 rounded bg-cyan-dark/70 text-cyan font-mono text-[9px] border border-cyan/20">
                32 ms
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2" title={isSimulationRunning ? 'Simulation running' : 'Paused'}>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isSimulationRunning ? 'bg-success animate-pulse' : 'bg-warning'
              }`}
            />
          </div>
        )}

        {/* Settings button */}
        <button
          onClick={() => setCurrentView('settings')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            currentView === 'settings'
              ? 'bg-[#152538] text-cyan'
              : 'text-text-secondary hover:text-text-primary hover:bg-[#111C2B]'
          }`}
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4 shrink-0 text-text-secondary" />
          {!sidebarCollapsed && <span>Settings</span>}
        </button>

        {/* EchoBYTE Team Footer */}
        <div className="pt-2 border-t border-border/50 flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded bg-[#132235] border border-border flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-text-primary">EB</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col leading-tight overflow-hidden">
              <span className="text-xs font-semibold text-text-primary truncate">EchoBYTE</span>
              <span className="text-[10px] text-text-muted truncate">Smart City & Mobility</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
