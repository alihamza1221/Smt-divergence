import React from 'react';
import { CVDAlert } from '@/contexts/AlertContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';

interface MatrixCellProps {
  alert?: CVDAlert;
}

const sessionStyles: Record<string, string> = {
  LND: 'bg-black/70 text-white',
  ASIA: 'bg-black/70 text-white',
  NY: 'bg-black/70 text-white',
};

const formatPrice = (price: number) => {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${price.toFixed(price < 1 ? 4 : 2)}`;
};

export const MatrixCell: React.FC<MatrixCellProps> = ({ alert }) => {
  if (!alert) {
    return (
      <div className="h-36 flex items-center justify-center bg-secondary/30 border border-border/20 rounded">
        <span className="text-muted-foreground text-base font-bold font-mono">--</span>
      </div>
    );
  }

  const isBullish = alert.cvd_direction === 'bullish';
  // Show session_low for bullish (looking to buy low), session_high for bearish (looking to sell high)
  const targetPrice = isBullish ? alert.session_low : alert.session_high;
  const priceLabel = isBullish ? 'Low' : 'High';
  const lastUpdate = new Date(alert.receivedAt);

  const tradingViewUrl = alert.exchange?.toUpperCase() === 'BINANCE'
    ? `https://www.tradingview.com/chart/?symbol=BINANCE:${alert.symbol}USDT.P`
    : `https://www.tradingview.com/chart/?symbol=BYBIT:${alert.symbol}USDT.P`;

  const handleClick = () => {
    window.open(tradingViewUrl, '_blank');
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          onClick={handleClick}
          className={cn(
            'h-36 px-1.5 py-1 rounded border border-transparent transition-all duration-300 cursor-pointer relative',
            'flex flex-col items-center justify-center gap-0.5',
            isBullish ? 'bg-matrix-bullish text-white' : 'bg-matrix-bearish text-white',
            isBullish && 'hover:bg-matrix-bullish/90',
            !isBullish && 'hover:bg-matrix-bearish/90'
          )}
        >
          {/* Top-left: Previous session */}
          {alert.previous_session && (
            <span className={cn(
              'absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-bold rounded',
              sessionStyles[alert.previous_session] || 'bg-black/70 text-white'
            )}>
              {alert.previous_session}
            </span>
          )}

          {/* Bottom-left: Sweep indicator */}
          {alert.isDivWithSweep && (
            <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-bold rounded bg-black/70 text-white">
              SWEEP
            </span>
          )}

          {/* Top-right: Exchange badge */}
          {alert.exchange && (
            <span className={cn(
              'absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold rounded',
              alert.exchange === 'BINANCE' ? 'bg-yellow-500/80 text-black' : 'bg-orange-500/80 text-white'
            )}>
              {alert.exchange === 'BYBIT' ? 'Bybit' : alert.exchange === 'BINANCE' ? 'Binance' : alert.exchange}
            </span>
          )}

          <span className="text-sm font-bold uppercase tracking-wider opacity-90">
            {isBullish ? 'Bullish Divergence' : 'Bearish Divergence'}
          </span>
          <span className="text-sm font-semibold opacity-80">
            {priceLabel} {formatPrice(targetPrice)}
          </span>
          <div className="text-xs font-mono opacity-70">
            <span>L1: {formatPrice(alert.pivot1)}</span>
            <span className="mx-1">|</span>
            <span>L2: {formatPrice(alert.pivot2)}</span>
          </div>
          <span className="text-xs font-semibold opacity-60">
            {format(lastUpdate, 'MMM d HH:mm')}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-semibold">{alert.symbol} - {alert.timeframe}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Target Price:</span>{' '}
            <span className="font-bold">{formatPrice(targetPrice)}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Pivot 1:</span>{' '}
            {formatPrice(alert.pivot1)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Pivot 2:</span>{' '}
            {formatPrice(alert.pivot2)}
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Last Update:</span>{' '}
            {format(lastUpdate, 'MMM dd, HH:mm:ss')}
          </p>
          {alert.previous_session && (
            <p className="text-sm">
              <span className="text-muted-foreground">Previous Session:</span>{' '}
              <span className={cn(
                'font-medium',
                alert.previous_session === 'LND' && 'text-blue-400',
                alert.previous_session === 'ASIA' && 'text-amber-400',
                alert.previous_session === 'NY' && 'text-purple-400'
              )}>{alert.previous_session}</span>
            </p>
          )}
          {alert.exchange && (
            <p className="text-sm">
              <span className="text-muted-foreground">Exchange:</span>{' '}
              <span className={cn(
                'font-medium',
                alert.exchange === 'BINANCE' ? 'text-yellow-400' : 'text-orange-400'
              )}>{alert.exchange}</span>
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Sweep:</span>{' '}
            <span className={cn('font-medium', alert.isDivWithSweep ? 'text-green-400' : 'text-muted-foreground')}>
              {alert.isDivWithSweep ? 'Yes' : 'No'}
            </span>
          </p>
          <p className="text-sm mt-2 font-medium capitalize">
            {isBullish ? '🟢 Bullish Divergence' : '🔴 Bearish Divergence'}
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
