// supabase/functions/search-assets/index.ts
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

    // *** MODIFICA: Usiamo l'API di ricerca di Yahoo Finance ***
    // Questa API gestisce bene nomi, ticker e ISIN.
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

      let ticker = item.symbol.toUpperCase();
      let currency = 'USD'; // Default

      // *** MODIFICA: Logica di mappatura valuta basata sul SUFFISSO ***
      // Questo ci permette di non filtrare le borse, ma di mappare
      // correttamente le valute per quelle che ci interessano.
      
      if (ticker.endsWith('.MI')) {
        currency = 'EUR';
      } 
      else if (ticker.endsWith('.DE')) {
        currency = 'EUR';
      } 
      else if (ticker.endsWith('.XETRA')) {
        // Converte .XETRA in .DE per compatibilità con fetch-prices
        ticker = ticker.replace('.XETRA', '.DE');
        currency = 'EUR';
      }
      else if (ticker.endsWith('.AS')) { // Amsterdam
        currency = 'EUR';
      } 
      else if (ticker.endsWith('.PA')) { // Parigi
        currency = 'EUR';
      } 
      else if (ticker.endsWith('.L')) { // Londra
        currency = 'GBP';
      } 
      else if (ticker.endsWith('.SW')) { // Svizzera
        currency = 'CHF';
      }
      // Se non ha un suffisso europeo, usa la valuta fornita da Yahoo
      else if (item.currency) { 
        currency = item.currency;
      }

      // Aggiungi solo se non è un duplicato
      if (!seenTickers.has(ticker)) {
        suggestions.push({
          ticker: ticker,
          isin: undefined, // Yahoo Search non fornisce ISIN
          name: item.shortname,
          currency: currency,
        });
        seenTickers.add(ticker);
      }
    }

    console.log(`Found ${suggestions.length} relevant results for "${query}"`);

    return new Response(JSON.stringify(suggestions.slice(0, 10)), { // Limitiamo a 10 risultati finali
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