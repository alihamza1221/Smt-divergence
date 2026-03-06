import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// In-memory storage for alerts (in production, use database)
const alertStore: Map<string, any> = new Map();

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  try {
    if (req.method === 'POST') {
      // Receive new alert from strategy
      const body = await req.json();
      
      console.log('Received CVD alert:', JSON.stringify(body));
      
      const {
        message,
        symbol,
        timeframe,
        time,
        session_high,
        session_low,
        active_session,
        cvd_direction,
        pivot1,
        pivot2,
      } = body;

      if (!symbol || !timeframe) {
        return new Response(
          JSON.stringify({ error: 'symbol and timeframe are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Normalize symbol (extract base like BTC from BTCUSDT)
      const normalizedSymbol = symbol.replace(/\/?(USDT|USD|BUSD)$/gi, '').toUpperCase();
      
      const key = `${normalizedSymbol}-${timeframe}`;
      
      const alert = {
        symbol: normalizedSymbol,
        timeframe,
        time: time || new Date().toISOString(),
        session_high: parseFloat(session_high) || 0,
        session_low: parseFloat(session_low) || 0,
        active_session: active_session || '',
        cvd_direction: cvd_direction?.toLowerCase() === 'bullish' ? 'bullish' : 'bearish',
        pivot1: parseFloat(pivot1) || 0,
        pivot2: parseFloat(pivot2) || 0,
        message: message || '',
        receivedAt: Date.now(),
      };

      alertStore.set(key, alert);
      
      console.log(`Alert stored: ${key}`, alert);

      return new Response(
        JSON.stringify({ success: true, key, alert }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // Return all current alerts
      const alerts: Record<string, any> = {};
      
      // Clean up expired alerts (default 15 min)
      const expiryMs = 15 * 60 * 1000;
      const now = Date.now();
      
      for (const [key, alert] of alertStore.entries()) {
        if (now - alert.receivedAt < expiryMs) {
          alerts[key] = alert;
        } else {
          alertStore.delete(key);
        }
      }

      console.log(`Returning ${Object.keys(alerts).length} alerts`);

      return new Response(
        JSON.stringify({ alerts }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'DELETE') {
      // Clear all alerts
      alertStore.clear();
      
      return new Response(
        JSON.stringify({ success: true, message: 'All alerts cleared' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
