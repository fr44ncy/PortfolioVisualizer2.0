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

    const apiUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=100&newsCount=0`;

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
      if (!item.symbol || !item.shortname || !validTypes.includes(item.quoteType)) {
        continue;
      }

      const ticker = item.symbol.toUpperCase();
      let finalTicker: string | null = null;
      const currency = 'EUR';

      if (ticker.endsWith('.MI')) {
        finalTicker = ticker;
      }
      else if (ticker.endsWith('.DE')) {
        finalTicker = ticker;
      }
      else if (ticker.endsWith('.XETRA')) {
        finalTicker = ticker.replace('.XETRA', '.DE');
      }
      else {
        continue;
      }

      if (finalTicker && !seenTickers.has(finalTicker)) {
        suggestions.push({
          ticker: finalTicker,
          isin: undefined,
          name: item.shortname,
          currency: currency,
        });
        seenTickers.add(finalTicker);
      }
    }

    console.log(`Found ${suggestions.length} XETRA/MI results for "${query}"`);

    return new Response(JSON.stringify(suggestions.slice(0, 15)), {
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