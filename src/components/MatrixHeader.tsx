import React from 'react';
import { ChevronDown, Settings } from 'lucide-react';
import { useAlerts, TIMEFRAMES } from '@/contexts/AlertContext';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MatrixHeaderProps {
  onToggleSettings: () => void;
  showSettings: boolean;
}

export const MatrixHeader: React.FC<MatrixHeaderProps> = ({ onToggleSettings, showSettings }) => {
  const { currentTime, symbols } = useAlerts();

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' UTC';
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">SMT Divergence Matrix</h1>
        <p className="text-sm text-muted-foreground">Real-time SMT Divergence monitoring</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-md bg-muted px-3 py-1.5 text-sm font-mono text-foreground">
          {formatDate(currentTime)}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Symbols ({symbols.length})
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            <div className="space-y-1">
              {symbols.map((symbol) => (
                <div
                  key={symbol}
                  className="px-3 py-2 text-sm rounded-md bg-muted/50 text-foreground"
                >
                  {symbol}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Timeframes ({TIMEFRAMES.length})
              <ChevronDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-2" align="end">
            <div className="space-y-1">
              {TIMEFRAMES.map((tf) => (
                <div
                  key={tf}
                  className="px-3 py-2 text-sm rounded-md bg-muted/50 text-foreground"
                >
                  {tf}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant={showSettings ? 'secondary' : 'ghost'}
          size="icon"
          onClick={onToggleSettings}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};
