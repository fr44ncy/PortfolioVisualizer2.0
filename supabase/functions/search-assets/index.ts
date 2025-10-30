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

    // Yahoo Finance search API (non ufficiale ma pubblico)
    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=10&newsCount=0`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.quotes || !Array.isArray(data.quotes)) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filtra solo azioni ed ETF
    const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
    
    const suggestions = data.quotes
      .filter((item: any) => 
        validTypes.includes(item.quoteType) && 
        item.symbol && 
        item.shortname
      )
      .map((item: any) => {
        // Determina la valuta in base all'exchange
        let currency = 'USD';
        const exchange = item.exchange || '';
        
        if (exchange.includes('MIL') || item.symbol.endsWith('.MI')) {
          currency = 'EUR'; // Milano
        } else if (exchange.includes('AMS') || item.symbol.endsWith('.AS')) {
          currency = 'EUR'; // Amsterdam
        } else if (exchange.includes('PAR') || item.symbol.endsWith('.PA')) {
          currency = 'EUR'; // Parigi
        } else if (exchange.includes('FRA') || exchange.includes('GER') || item.symbol.endsWith('.DE')) {
          currency = 'EUR'; // XETRA/Germania
        } else if (exchange.includes('LSE') || item.symbol.endsWith('.L')) {
          currency = 'GBP'; // Londra
        } else if (exchange.includes('SWX') || item.symbol.endsWith('.SW')) {
          currency = 'CHF'; // Svizzera
        }

        return {
          ticker: item.symbol,
          isin: undefined, // Yahoo Finance non fornisce ISIN
          name: item.shortname || item.longname || item.symbol,
          currency: currency,
        };
      });

    // Rimuovi duplicati per ticker
    const uniqueTickers = new Set<string>();
    const uniqueSuggestions = suggestions.filter((s: any) => {
      if (uniqueTickers.has(s.ticker)) return false;
      uniqueTickers.add(s.ticker);
      return true;
    });

    console.log(`Found ${uniqueSuggestions.length} results for "${query}"`);

    return new Response(JSON.stringify(uniqueSuggestions.slice(0, 8)), {
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