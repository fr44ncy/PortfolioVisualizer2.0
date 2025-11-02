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

    // Usiamo l'API di ricerca di Yahoo Finance
    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=25&newsCount=0`;

    const response = await fetch(apiUrl, {
      headers: {
        // È buona norma aggiungere un User-Agent
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

      const ticker = item.symbol.toUpperCase();
      let finalTicker: string | null = null;
      let currency: string | null = null;

      // *** MODIFICA: Logica di FILTRAGGIO restrittiva ***
      // Includiamo solo i mercati richiesti (MI, XETRA) che sono in EUR.
      
      if (ticker.endsWith('.MI')) {
        // Borsa Italiana (Milano)
        finalTicker = ticker;
        currency = 'EUR';
      } 
      else if (ticker.endsWith('.DE')) {
        // Xetra (Germania), suffisso .DE
        finalTicker = ticker;
        currency = 'EUR';
      }
      else if (ticker.endsWith('.XETRA')) {
        // Xetra (Germania), suffisso .XETRA
        // Convertiamo in .DE per compatibilità con altre API Yahoo
        finalTicker = ticker.replace('.XETRA', '.DE');
        currency = 'EUR';
      }
      // Tutti gli altri suffissi (.AS, .PA, .L, .SW, etc.) o l'assenza
      // di suffisso (mercati USA) vengono ignorati.

      // Aggiungi solo se è un mercato valido (EUR) e non è un duplicato
      if (finalTicker && currency === 'EUR' && !seenTickers.has(finalTicker)) {
        suggestions.push({
          ticker: finalTicker,
          isin: undefined, // L'API search di Yahoo non fornisce l'ISIN
          name: item.shortname,
          currency: currency,
        });
        seenTickers.add(finalTicker);
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