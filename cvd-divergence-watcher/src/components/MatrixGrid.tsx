import React from 'react';
import { useAlerts, TIMEFRAMES } from '@/contexts/AlertContext';
import { MatrixCell } from './MatrixCell';
import { Loader2 } from 'lucide-react';

export const MatrixGrid: React.FC = () => {
  const { getAlert, symbols, symbolsLoading, settings } = useAlerts();

  // Helper to get alert with sweep filter applied
  const getFilteredAlert = (symbol: string, timeframe: string) => {
    const alert = getAlert(symbol, timeframe);
    if (!alert) return undefined;
    
    // If showOnlySweeps is enabled, only return alerts with isDivWithSweep = true
    if (settings.showOnlySweeps && !alert.isDivWithSweep) {
      return undefined;
    }

    // Filter by exchange
    if (alert.exchange) {
      const ex = alert.exchange.toUpperCase();
      if (ex === 'BYBIT' && !settings.showBybit) return undefined;
      if (ex === 'BINANCE' && !settings.showBinance) return undefined;
    }
    
    return alert;
  };

  if (symbolsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse table-fixed">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-16 bg-background px-2 py-3 text-left text-sm font-medium text-muted-foreground">
              {/* Empty corner cell */}
            </th>
            {TIMEFRAMES.map((tf) => (
              <th
                key={tf}
                style={{ width: `${(100 - 8) / TIMEFRAMES.length}%` }}
                className="border-b border-border bg-background p-3 text-center text-sm font-medium text-muted-foreground"
              >
                {tf}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => (
            <tr key={symbol} className="border-b border-border">
              <td className="sticky left-0 z-10 w-16 bg-background px-2 py-3 text-sm font-semibold text-muted-foreground">
                {symbol}
              </td>
              {TIMEFRAMES.map((tf) => {
                const alert = getFilteredAlert(symbol, tf);
                return (
                  <td key={`${symbol}-${tf}`} className="border border-border p-0">
                    <MatrixCell alert={alert} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
