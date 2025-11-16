import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { ticker, currency: reqCurrency, days } = await req.json();
    const currency = reqCurrency || "EUR";

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: "Parametro 'ticker' obbligatorio" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    let finnhubTicker = ticker;
    if (ticker.endsWith(".MI") || ticker.endsWith(".DE")) {
      finnhubTicker = ticker;
    }

    console.log(`Fetching Finnhub data for ${finnhubTicker}...`);

    const endDate = Math.floor(Date.now() / 1000);
    const defaultDays = 20 * 365;
    const periodDays = days ? Number(days) : defaultDays;
    const startDate = Math.floor((Date.now() - (periodDays * 24 * 60 * 60 * 1000)) / 1000);

    const apiUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(finnhubTicker)}&resolution=D&from=${startDate}&to=${endDate}&token=${finnhubKey}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      console.error(`Finnhub returned ${response.status}`);
      return new Response(
        JSON.stringify({ 
          error: `Ticker '${ticker}' non trovato o non valido` 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    if (!data.t || !data.c || data.t.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `Nessun dato disponibile per '${ticker}'` 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
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
          close: parseFloat(closePrice.toFixed(4)),
          currency: currency,
        });
      }
    }

    if (prices.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: `Dati non validi per '${ticker}'` 
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    prices.sort((a, b) => a.date.localeCompare(b.date));

    console.log(`✓ Successfully fetched ${prices.length} days for ${ticker}`);

    return new Response(JSON.stringify(prices), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in fetch-prices:", error);
    return new Response(
      JSON.stringify({ 
        error: `Errore nel recupero dati: ${(error as Error).message}` 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});