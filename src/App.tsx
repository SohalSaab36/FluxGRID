import React from 'react';
import { TrafficProvider, useTraffic } from './context/TrafficContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Overview } from './pages/Overview';
import { LiveTrafficMap } from './pages/LiveTrafficMap';
import { IntersectionControl } from './pages/IntersectionControl';
import { VehicleDetection } from './pages/VehicleDetection';
import { PerformanceAnalytics } from './pages/PerformanceAnalytics';
import { SimulationLab } from './pages/SimulationLab';
import { Settings } from './pages/Settings';
import { Account } from './pages/Account';
import { AdminReports } from './pages/AdminReports';

const AppContent: React.FC = () => {
  const { currentView } = useTraffic();

  const renderCurrentView = () => {
    switch (currentView) {
      case 'overview':
        return <Overview />;
      case 'map':
        return <LiveTrafficMap />;
      case 'intersections':
        return <IntersectionControl />;
      case 'detection':
        return <VehicleDetection />;
      case 'analytics':
        return <PerformanceAnalytics />;
      case 'simulation':
        return <SimulationLab />;
      case 'settings':
        return <Settings />;
      case 'account':
        return <Account />;
      case 'admin':
        return <AdminReports />;
      default:
        return <Overview />;
    }
  };

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-bg-dark font-sans text-text-primary">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Header />
        <main id="main-content" className="min-h-0 min-w-0 flex-1 flex flex-col overflow-y-auto overscroll-y-contain">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <TrafficProvider>
      <AppContent />
    </TrafficProvider>
  );
};

export default App;
