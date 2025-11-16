import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function getFxSymbol(from: string, to: string): string | null {
  if (from === to) return null;
  return `${from}${to}`;
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
    
    const symbol = getFxSymbol(from, to);
    if (!symbol) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - (days || 365 * 5));
      
      let prices = [];
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
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

    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    console.log(`Fetching FX rates for ${symbol}...`);

    const endDate = Math.floor(Date.now() / 1000);
    const periodDays = days ? Number(days) : (365 * 20);
    const startDate = Math.floor((Date.now() - (periodDays * 24 * 60 * 60 * 1000)) / 1000);

    const apiUrl = `https://finnhub.io/api/v1/forex/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${startDate}&to=${endDate}&token=${finnhubKey}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Finnhub FX API returned ${response.status} for pair ${symbol}`);
    }

    const data = await response.json();

    if (!data.t || !data.c || data.t.length === 0) {
      throw new Error(`Dati FX non validi per ${symbol}`);
    }

    const timestamps = data.t;
    const closes = data.c;

    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closePrice = closes[i];
      if (closePrice !== null && closePrice !== undefined && closePrice > 0) {
        const date = new Date(timestamps[i] * 1000);
        const dateStr = date.toISOString().split('T')[0];
        prices.push({
          date: dateStr,
          close: parseFloat(closePrice.toFixed(6)),
          currency: to,
        });
      }
    }
    
    prices.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✓ Successfully fetched ${prices.length} FX rates for ${symbol}`);

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