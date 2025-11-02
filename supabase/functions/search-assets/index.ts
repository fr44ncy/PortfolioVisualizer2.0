// supabase/functions/search-assets/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Codici borsa di Yahoo Finance che vogliamo mappare
const ALLOWED_EXCHANGES = ['MIL', 'GER', 'XET']; // MIL=Milano, GER=Xetra(Germania), XET=Xetra

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 2 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Searching Yahoo Finance for: ${query}`);

    // Usiamo l'API di ricerca di Yahoo Finance
    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=25&newsCount=0`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance search returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.quotes || !Array.isArray(data.quotes)) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
    const seenTickers = new Set<string>();
    const suggestions = [];

    for (const item of data.quotes) {
      // Controllo di validità base
      if (!item.symbol || !item.shortname || !validTypes.includes(item.quoteType)) {
        continue;
      }

      const symbolUpper = item.symbol.toUpperCase();
      const exchangeUpper = (item.exchange || '').toUpperCase();
      
      let finalTicker = "";
      const currency = "EUR"; // Assumiamo EUR per queste borse

      // *** LOGICA DI FILTRO E MAPPATURA CORRETTA ***

      // 1. Il simbolo ha già un suffisso .MI (Milano)
      if (symbolUpper.endsWith('.MI')) {
        finalTicker = symbolUpper;
      }
      // 2. Il simbolo ha già un suffisso .DE (Xetra/Germania)
      else if (symbolUpper.endsWith('.DE')) {
        finalTicker = symbolUpper;
      }
      // 3. Il simbolo ha un suffisso .XETRA (Xetra alternativo)
      else if (symbolUpper.endsWith('.XETRA')) {
        // Converti .XETRA in .DE per compatibilità con la funzione fetch-prices
        finalTicker = symbolUpper.replace('.XETRA', '.DE');
      }
      // 4. Il simbolo NON ha suffisso, controlliamo il codice borsa
      else if (ALLOWED_EXCHANGES.includes(exchangeUpper)) {
        if (exchangeUpper === 'MIL') {
          finalTicker = `${symbolUpper}.MI`;
        } else if (exchangeUpper === 'GER' || exchangeUpper === 'XET') {
          finalTicker = `${symbolUpper}.DE`;
        }
      }

      // Se abbiamo trovato un ticker valido e non è un duplicato...
      if (finalTicker && !seenTickers.has(finalTicker)) {
        suggestions.push({
          ticker: finalTicker,
          isin: undefined, // Yahoo Search non fornisce ISIN
          name: item.shortname,
          currency: currency,
        });
        seenTickers.add(finalTicker);
      }
    }

    console.log(`Found ${suggestions.length} results for "${query}" on MI & DE/XETRA`);

    return new Response(JSON.stringify(suggestions.slice(0, 10)), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in search-assets:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});