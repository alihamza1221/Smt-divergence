import React, { useState } from 'react';
import { Settings, Loader2, X, Plus, Eye, EyeOff, Check } from 'lucide-react';
import { useAlerts } from '@/contexts/AlertContext';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const REFRESH_OPTIONS = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
];

export const SettingsSidebar: React.FC = () => {
  const { settings, settingsLoading, updateSettings } = useAlerts();
  const [newTimeframe, setNewTimeframe] = useState('');
  const [botToken, setBotToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramSaved, setTelegramSaved] = useState(false);

  const handleAddTimeframe = async () => {
    const tf = newTimeframe.trim().toLowerCase();
    if (!tf || settings.allowedAlertTimeframes.includes(tf)) {
      setNewTimeframe('');
      return;
    }
    
    const updatedTimeframes = [...settings.allowedAlertTimeframes, tf];
    updateSettings({ allowedAlertTimeframes: updatedTimeframes });
    setNewTimeframe('');
    
    // Update backend
    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedAlertTimeframes: updatedTimeframes }),
      });
    } catch (err) {
      console.error('Failed to update timeframes:', err);
    }
  };

  const handleRemoveTimeframe = async (tf: string) => {
    const updatedTimeframes = settings.allowedAlertTimeframes.filter(t => t !== tf);
    updateSettings({ allowedAlertTimeframes: updatedTimeframes });
    
    // Update backend
    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedAlertTimeframes: updatedTimeframes }),
      });
    } catch (err) {
      console.error('Failed to update timeframes:', err);
    }
  };

  const handleRefreshDurationChange = async (value: string) => {
    const newDuration = parseInt(value, 10);
    updateSettings({ refreshDuration: newDuration });
    
    // Update backend expiry time
    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiryMinutes: newDuration }),
      });
    } catch (err) {
      console.error('Failed to update backend settings:', err);
    }
  };

  const handleTelegramToggle = async (checked: boolean) => {
    updateSettings({ telegramAlerts: checked });
    
    // Update backend Telegram setting
    try {
      await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramAlertsEnabled: checked }),
      });
    } catch (err) {
      console.error('Failed to update Telegram setting:', err);
    }
  };

  const handleSaveTelegramConfig = async () => {
    // Only send fields that have values (not empty)
    const payload: { telegramBotToken?: string; telegramChatId?: string } = {};
    
    if (botToken.trim()) {
      payload.telegramBotToken = botToken.trim();
    }
    if (chatId.trim()) {
      payload.telegramChatId = chatId.trim();
    }
    
    if (Object.keys(payload).length === 0) {
      return; // Nothing to save
    }
    
    setSavingTelegram(true);
    setTelegramSaved(false);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      if (response.ok) {
        const data = await response.json();
        updateSettings({
          telegramBotToken: data.telegramBotToken ?? '',
          telegramChatId: data.telegramChatId ?? '',
          telegramConfigured: data.telegramConfigured ?? false,
        });
        // Clear inputs after successful save
        setBotToken('');
        setChatId('');
        setTelegramSaved(true);
        setTimeout(() => setTelegramSaved(false), 2000);
      }
    } catch (err) {
      console.error('Failed to update Telegram config:', err);
    } finally {
      setSavingTelegram(false);
    }
  };

  return (
    <div className="flex h-full w-96 flex-col border-l border-border bg-sidebar p-4 overflow-y-auto scrollbar-none">
      <div className="mb-6 flex items-center gap-2">
        <Settings className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
      </div>

      <div className="space-y-6">
        {settingsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Telegram Alerts Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="telegram-alerts" className="text-sm text-foreground">
                Telegram Alerts
              </Label>
              <Switch
                id="telegram-alerts"
                checked={settings.telegramAlerts}
                onCheckedChange={handleTelegramToggle}
              />
            </div>

            {/* Show Only Sweeps Toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="only-sweeps" className="text-sm text-foreground">
                  Only Sweeps
                </Label>
                <p className="text-[10px] text-muted-foreground">
                  Show only alerts with liquidity sweep
                </p>
              </div>
              <Switch
                id="only-sweeps"
                checked={settings.showOnlySweeps}
                onCheckedChange={(checked) => updateSettings({ showOnlySweeps: checked })}
              />
            </div>

            {/* Exchange Filter */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Exchange Filter</Label>
              <p className="text-[10px] text-muted-foreground">
                Show divergences from selected exchanges
              </p>
              <div className="flex gap-2 mt-1">
                <Button
                  size="sm"
                  variant={settings.showBybit ? 'default' : 'outline'}
                  onClick={() => updateSettings({ showBybit: !settings.showBybit })}
                  className={`flex-1 h-8 text-xs font-bold ${settings.showBybit ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'text-muted-foreground'}`}
                >
                  Bybit
                </Button>
                <Button
                  size="sm"
                  variant={settings.showBinance ? 'default' : 'outline'}
                  onClick={() => updateSettings({ showBinance: !settings.showBinance })}
                  className={`flex-1 h-8 text-xs font-bold ${settings.showBinance ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'text-muted-foreground'}`}
                >
                  Binance
                </Button>
              </div>
            </div>

            {/* Telegram Configuration */}
            <div className="space-y-3 rounded-md border border-border p-3">
              <Label className="text-sm font-medium text-foreground">Telegram Configuration</Label>
              
              {settings.telegramConfigured && (
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <Check className="h-3 w-3" />
                  <span>Configured</span>
                </div>
              )}
              
              {/* Current Bot Token (masked) */}
              {settings.telegramBotToken && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Current Token:</p>
                  <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{settings.telegramBotToken}</p>
                </div>
              )}
              
              {/* Current Chat ID */}
              {settings.telegramChatId && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Current Chat ID:</p>
                  <p className="text-xs font-mono bg-muted px-2 py-1 rounded">{settings.telegramChatId}</p>
                </div>
              )}
              
              {/* New Bot Token Input */}
              <div className="space-y-1">
                <Label htmlFor="bot-token" className="text-xs text-muted-foreground">
                  {settings.telegramBotToken ? 'Update Bot Token' : 'Bot Token'}
                </Label>
                <div className="relative">
                  <Input
                    id="bot-token"
                    type={showToken ? 'text' : 'password'}
                    placeholder="Enter bot token from @BotFather"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    className="h-8 text-xs pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              
              {/* Chat ID Input */}
              <div className="space-y-1">
                <Label htmlFor="chat-id" className="text-xs text-muted-foreground">
                  {settings.telegramChatId ? 'Update Chat ID' : 'Chat ID'}
                </Label>
                <Input
                  id="chat-id"
                  type="text"
                  placeholder="Enter chat ID"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  className="h-8 text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  Get from @userinfobot or @getmyid_bot
                </p>
              </div>
              
              {/* Save Button */}
              <Button
                size="sm"
                onClick={handleSaveTelegramConfig}
                disabled={savingTelegram || (!botToken.trim() && !chatId.trim())}
                className="w-full h-8 text-xs"
              >
                {savingTelegram ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : telegramSaved ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : null}
                {telegramSaved ? 'Saved!' : 'Save Telegram Config'}
              </Button>
            </div>

            {/* Refresh Duration */}
            <div className="space-y-2">
              <Label htmlFor="refresh-duration" className="text-sm text-foreground">
                Refresh Duration
              </Label>
              <Select
                value={settings.refreshDuration.toString()}
                onValueChange={handleRefreshDurationChange}
              >
                <SelectTrigger id="refresh-duration" className="w-full">
                  <SelectValue placeholder="Select duration" />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Alert Timeframes */}
            <div className="space-y-2">
              <Label className="text-sm text-foreground">Alert Timeframes</Label>
              <p className="text-xs text-muted-foreground">
                Telegram alerts will only be sent for these timeframes
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {settings.allowedAlertTimeframes.map((tf) => (
                  <Badge
                    key={tf}
                    variant="secondary"
                    className="flex items-center gap-1 pr-1"
                  >
                    {tf}
                    <button
                      onClick={() => handleRemoveTimeframe(tf)}
                      className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="e.g. 1m, 1h"
                  value={newTimeframe}
                  onChange={(e) => setNewTimeframe(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTimeframe()}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAddTimeframe}
                  className="h-8 px-2"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Status Info */}
            <div className="mt-8 rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                Alerts expire after <span className="font-semibold text-foreground">{settings.refreshDuration} minutes</span> unless updated.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
