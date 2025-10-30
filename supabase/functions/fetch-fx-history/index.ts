// supabase/functions/fetch-fx-history/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Funzione helper per creare il ticker FX di Yahoo
function getFxTicker(from: string, to: string) {
  if (from === to) return null;
  // Yahoo usa "X" per i tassi cross (es. USDEUR=X)
  return `${from}${to}=X`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { from, to, days } = await req.json();
    
    if (!from || !to) {
      return new Response(JSON.stringify({ error: "Parametri 'from' e 'to' obbligatori" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const ticker = getFxTicker(from, to);
    if (!ticker) {
      // Se le valute sono uguali, restituiamo una serie "piatta" con valore 1
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days || 365 * 5));
      
      let prices = [];
      for (let d = startDate; d <= endDate; d.setDate(d.getDate() + 1)) {
        prices.push({
          date: d.toISOString().split('T')[0],
          close: 1,
          currency: to,
        });
      }
      return new Response(JSON.stringify(prices), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetching FX rates for ${ticker}...`);

    const endDate = Math.floor(Date.now() / 1000);
    const periodDays = days ? Number(days) : (365 * 20); // 20 anni default
    const startDate = Math.floor((Date.now() - (periodDays * 24 * 60 * 60 * 1000)) / 1000);

    const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status} for FX ticker ${ticker}`);
    }

    const data = await response.json();
    const result = data.chart?.result?.[0];
    const timestamps = result?.timestamp;
    const quotes = result?.indicators?.quote?.[0];
    const adjClose = quotes?.close; // Per FX, 'close' va bene

    if (!timestamps || !adjClose) {
      throw new Error(`Dati FX non validi per ${ticker}`);
    }

    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closePrice = adjClose[i];
      if (closePrice !== null && closePrice !== undefined && closePrice > 0) {
        const date = new Date(timestamps[i] * 1000);
        const dateStr = date.toISOString().split('T')[0];
        prices.push({
          date: dateStr,
          close: parseFloat(closePrice.toFixed(6)), // Usa più decimali per FX
          currency: to,
        });
      }
    }
    
    prices.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✓ Successfully fetched ${prices.length} FX rates for ${ticker}`);

    return new Response(JSON.stringify(prices), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in fetch-fx-history:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});