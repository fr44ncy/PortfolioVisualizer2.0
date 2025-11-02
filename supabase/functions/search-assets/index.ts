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
    // Questa API restituisce i ticker con i suffissi corretti (.MI, .DE)
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

    // Tipi validi e suffissi di borsa richiesti
    const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
    // *** MODIFICA CHIAVE: Filtriamo per i suffissi che Yahoo usa per MILANO (.MI) e XETRA (.DE) ***
    const allowedSuffixes = ['.MI', '.DE']; 
    
    const suggestions = data.quotes
      .filter((item: any) => {
        if (!item.symbol || !item.shortname || !validTypes.includes(item.quoteType)) {
          return false;
        }
        // Controlla se il simbolo termina con uno dei suffissi consentiti
        return allowedSuffixes.some(suffix => item.symbol.toUpperCase().endsWith(suffix));
      })
      .map((item: any) => {
        // Determina la valuta corretta (Yahoo a volte sbaglia, ma MI e DE sono EUR)
        const currency = item.symbol.toUpperCase().endsWith('.MI') || item.symbol.toUpperCase().endsWith('.DE') ? 'EUR' : item.currency;

        return {
          ticker: item.symbol.toUpperCase(), // Es. "ISP.MI" o "EUNL.DE"
          isin: undefined, // Yahoo Search non fornisce ISIN
          name: item.shortname,
          currency: currency,
        };
      });

    // Rimuoviamo duplicati esatti (raro, ma possibile)
    const uniqueSuggestions = Array.from(new Map(suggestions.map(s => [s.ticker, s])).values());

    console.log(`Found ${uniqueSuggestions.length} results for "${query}" on MI & DE`);

    return new Response(JSON.stringify(uniqueSuggestions.slice(0, 10)), {
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