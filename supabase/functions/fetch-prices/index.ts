// supabase/functions/fetch-prices/index.ts
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
    const currency = reqCurrency || "USD";

    if (!ticker) {
      return new Response(
        JSON.stringify({ error: "Parametro 'ticker' obbligatorio" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let yahooTicker = ticker;
    
    // *** MODIFICA: Gestisce i ticker EODHD (es. "AAPL.US" -> "AAPL") ***
    if (yahooTicker.endsWith('.US')) {
      yahooTicker = yahooTicker.replace('.US', '');
    }

    // Mapping per exchange europei (Yahoo li richiede, EODHD li fornisce)
    const exchangeMap: Record<string, string> = {
      '.MI': '.MI',    // Milano
      '.AS': '.AS',    // Amsterdam
      '.L': '.L',      // Londra
      '.DE': '.DE',    // XETRA
      '.PA': '.PA',    // Parigi
      '.SW': '.SW',    // Svizzera
      '.AMS': '.AS',   // Amsterdam alternativo (mappato a .AS)
    };

    let hasSuffix = false;
    for (const suffix of Object.keys(exchangeMap)) {
      if (ticker.endsWith(suffix)) {
        hasSuffix = true;
        if (suffix === '.AMS') {
          yahooTicker = ticker.replace('.AMS', '.AS');
        }
        break;
      }
    }

    console.log(`Fetching Yahoo Finance data for ${yahooTicker}...`);

    // Calcola date per periodo (usa 'days' fornito dal client)
    const endDate = Math.floor(Date.now() / 1000);
    const defaultDays = 20 * 365; // 20 anni (default)
    const periodDays = days ? Number(days) : defaultDays;
    const startDate = Math.floor((Date.now() - (periodDays * 24 * 60 * 60 * 1000)) / 1000);

    // Yahoo Finance API endpoint (non ufficiale ma pubblico)
    const apiUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?period1=${startDate}&period2=${endDate}&interval=1d`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error(`Yahoo Finance returned ${response.status}`);
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

    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
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

    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const adjClose = result.indicators.adjclose?.[0]?.adjclose || quotes.close;

    if (!timestamps || !adjClose) {
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

    const prices = [];
    for (let i = 0; i < timestamps.length; i++) {
      const closePrice = adjClose[i];
      if (closePrice !== null && closePrice !== undefined && closePrice > 0) {
        const date = new Date(timestamps[i] * 1000);
        const dateStr = date.toISOString().split('T')[0];
        
        prices.push({
          date: dateStr,
          close: parseFloat(closePrice.toFixed(4)),
          currency: currency, // La valuta richiesta dal client (valuta natia dell'asset)
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

    // Ordina per data
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