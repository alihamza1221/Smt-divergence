import React, { useState, useEffect, useCallback } from 'react';
import { MatrixGrid } from '@/components/MatrixGrid';
import { MatrixHeader } from '@/components/MatrixHeader';
import { SettingsSidebar } from '@/components/SettingsSidebar';
import { useAlerts, CVDAlert } from '@/contexts/AlertContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const Index = () => {
  const [showSettings, setShowSettings] = useState(true);
  const { addAlert } = useAlerts();

  // Fetch alerts from Node.js backend
  const fetchAlerts = useCallback(async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/cvd-alerts`);
      
      if (!response.ok) {
        console.error('Error fetching alerts:', response.statusText);
        return;
      }

      const data = await response.json();

      if (data?.alerts) {
        Object.values(data.alerts).forEach((alert: any) => {
          addAlert(alert as CVDAlert);
        });
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, [addAlert]);

  useEffect(() => {
    fetchAlerts();
    
    // Poll for updates every 5 seconds (faster since it's local)
    const interval = setInterval(fetchAlerts, 5000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return (
    <div className="flex h-screen flex-col bg-background">
      <MatrixHeader onToggleSettings={() => setShowSettings(!showSettings)} showSettings={showSettings} />
      
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-auto p-4 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <MatrixGrid />
        </main>
        
        {showSettings && <SettingsSidebar />}
      </div>
    </div>
  );
};

export default Index;
