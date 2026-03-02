import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface CVDAlert {
  symbol: string;
  timeframe: string;
  cvd_direction: 'bullish' | 'bearish';
  pivot1: number;
  pivot2: number;
  session_high: number;
  session_low: number;
  active_session: string;
  previous_session: string;
  isDivWithSweep: boolean;
  time: string;
  message: string;
  exchange?: string;
  receivedAt: number;
}

interface Settings {
  telegramAlerts: boolean;
  refreshDuration: number; // in minutes
  allowedAlertTimeframes: string[]; // timeframes that trigger Telegram alerts
  telegramBotToken: string; // Masked bot token from backend
  telegramChatId: string;
  telegramConfigured: boolean;
  showOnlySweeps: boolean; // Only show alerts with sweeps
  showBybit: boolean; // Show Bybit exchange alerts
  showBinance: boolean; // Show Binance exchange alerts
}

interface AlertContextType {
  alerts: Map<string, CVDAlert>;
  settings: Settings;
  settingsLoading: boolean;
  symbols: string[];
  symbolsLoading: boolean;
  updateSettings: (settings: Partial<Settings>) => void;
  addAlert: (alert: CVDAlert) => void;
  getAlert: (symbol: string, timeframe: string) => CVDAlert | undefined;
  currentTime: Date;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

const DEFAULT_SYMBOLS = ['BTC', 'ETH', 'BNB', 'SOL', 'SUI', 'XRP'];
const TIMEFRAMES = ['30s', '1m', '5m', '15m'];

// Normalize symbol by removing "USDT" and ".P" suffixes (e.g., "BTCUSDT.P" → "BTC")
const normalizeSymbol = (symbol: string): string => {
  return symbol.replace(/USDT/i, '').replace(/\.P$/i, '');
};

// Normalize timeframe to match TIMEFRAMES format (e.g., "1" → "1m", "45" → "45s")
const normalizeTimeframe = (timeframe: string): string => {
  // If already has suffix, return as-is
  if (/[ms]$/i.test(timeframe)) {
    return timeframe.toLowerCase();
  }
  // Check if it matches a minute timeframe
  if (TIMEFRAMES.includes(`${timeframe}m`)) {
    return `${timeframe}m`;
  }
  // Check if it matches a second timeframe
  if (TIMEFRAMES.includes(`${timeframe}s`)) {
    return `${timeframe}s`;
  }
  // Fallback: assume minutes for values <= 15, seconds otherwise
  return parseInt(timeframe) <= 15 ? `${timeframe}m` : `${timeframe}s`;
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<Map<string, CVDAlert>>(new Map());
  const [settings, setSettings] = useState<Settings>({
    telegramAlerts: true,
    refreshDuration: 15,
    allowedAlertTimeframes: ['5m', '15m', '30m'],
    telegramBotToken: '',
    telegramChatId: '',
    telegramConfigured: false,
    showOnlySweeps: false,
    showBybit: true,
    showBinance: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [symbols, setSymbols] = useState<string[]>(DEFAULT_SYMBOLS);
  const [symbolsLoading, setSymbolsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch settings and symbols from backend on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/settings`);
        if (response.ok) {
          const data = await response.json();
          setSettings((prev) => ({
            ...prev,
            telegramAlerts: data.telegramAlertsEnabled ?? true,
            refreshDuration: data.expiryMinutes ?? 15,
            allowedAlertTimeframes: data.allowedAlertTimeframes ?? ['5m', '15m', '30m'],
            telegramBotToken: data.telegramBotToken ?? '',
            telegramChatId: data.telegramChatId ?? '',
            telegramConfigured: data.telegramConfigured ?? false,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch settings from backend:', err);
      } finally {
        setSettingsLoading(false);
      }
    };

    const fetchSymbols = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/symbols`);
        if (response.ok) {
          const data = await response.json();
          const rawSymbols: string[] = data.symbols ?? DEFAULT_SYMBOLS;
          // Normalize and deduplicate symbols
          const normalizedSymbols = [...new Set(rawSymbols.map(normalizeSymbol))];
          setSymbols(normalizedSymbols);
        }
      } catch (err) {
        console.error('Failed to fetch symbols from backend:', err);
      } finally {
        setSymbolsLoading(false);
      }
    };

    fetchSettings();
    fetchSymbols();
  }, []);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Clean up expired alerts based on refresh duration
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const expiryMs = settings.refreshDuration * 60 * 1000;

      setAlerts((prev) => {
        const newAlerts = new Map(prev);
        let hasChanges = false;

        for (const [key, alert] of newAlerts) {
          if (now - alert.receivedAt > expiryMs) {
            newAlerts.delete(key);
            hasChanges = true;
          }
        }

        return hasChanges ? newAlerts : prev;
      });
    }, 10000); // Check every 10 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [settings.refreshDuration]);

  const updateSettings = useCallback((newSettings: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const addAlert = useCallback((alert: CVDAlert) => {
    const normalizedSymbol = normalizeSymbol(alert.symbol);
    const normalizedTimeframe = normalizeTimeframe(alert.timeframe);
    const key = `${normalizedSymbol}-${normalizedTimeframe}`;
    setAlerts((prev) => {
      const newAlerts = new Map(prev);
      newAlerts.set(key, { ...alert, symbol: normalizedSymbol, timeframe: normalizedTimeframe, receivedAt: Date.now() });
      return newAlerts;
    });
    // Add symbol if not already in list
    setSymbols((prev) => {
      if (!prev.includes(normalizedSymbol)) {
        return [...prev, normalizedSymbol];
      }
      return prev;
    });
  }, []);

  const getAlert = useCallback(
    (symbol: string, timeframe: string): CVDAlert | undefined => {
      const normalizedSymbol = normalizeSymbol(symbol);
      const normalizedTimeframe = normalizeTimeframe(timeframe);
      const key = `${normalizedSymbol}-${normalizedTimeframe}`;
      return alerts.get(key);
    },
    [alerts]
  );

  return (
    <AlertContext.Provider
      value={{
        alerts,
        settings,
        settingsLoading,
        symbols,
        symbolsLoading,
        updateSettings,
        addAlert,
        getAlert,
        currentTime,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within an AlertProvider');
  }
  return context;
};

export { DEFAULT_SYMBOLS, TIMEFRAMES };
