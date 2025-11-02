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
    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`;

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

    // Tipi validi
    const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
    
    const suggestions = data.quotes
      .filter((item: any) => 
        item.symbol && 
        item.shortname &&
        validTypes.includes(item.quoteType)
        // *** MODIFICA: Filtro di borsa restrittivo RIMOSSO ***
      )
      .map((item: any) => {
        let currency = 'EUR'; // Default
        const symbolUpper = item.symbol.toUpperCase();
        
        // *** MODIFICA: Logica di mappatura valuta basata sul SUFFISSO (più affidabile) ***
        if (symbolUpper.endsWith('.MI')) {
          currency = 'EUR';
        } else if (symbolUpper.endsWith('.DE') || symbolUpper.endsWith('.XETRA')) {
          currency = 'EUR';
        } else if (item.currency) {
          // Usa la valuta fornita da Yahoo se non è una borsa EU nota
          currency = item.currency;
        }

        let ticker = symbolUpper;
        // Converte .XETRA in .DE per compatibilità con fetch-prices
        if (ticker.endsWith('.XETRA')) {
          ticker = ticker.replace('.XETRA', '.DE');
        }

        return {
          ticker: ticker,
          isin: undefined, // Yahoo Search non fornisce ISIN
          name: item.shortname,
          currency: currency,
        };
      });

    // Rimuoviamo duplicati (es. se trova sia .DE che .XETRA che puntano allo stesso .DE)
    const uniqueTickers = new Set<string>();
    const uniqueSuggestions = suggestions.filter((s: any) => {
      if (uniqueTickers.has(s.ticker)) return false;
      uniqueTickers.add(s.ticker);
      return true;
    });

    console.log(`Found ${uniqueSuggestions.length} relevant results for "${query}"`);

    return new Response(JSON.stringify(uniqueSuggestions.slice(0, 10)), { // Limitiamo a 10 risultati finali
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