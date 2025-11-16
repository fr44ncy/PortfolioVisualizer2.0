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

    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    console.log(`Searching Finnhub for: ${query}`);

    const apiUrl = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${finnhubKey}`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`Finnhub search returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.result || !Array.isArray(data.result)) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const europeanExchanges = ['XETRA', 'MIC', 'MILANEX'];
    const seenTickers = new Set<string>();
    const suggestions = [];

    for (const item of data.result) {
      if (!item.symbol || !item.description) {
        continue;
      }

      const ticker = item.symbol.toUpperCase();
      const exchange = (item.exchange || "").toUpperCase();

      let finalTicker: string | null = null;
      let currency = "EUR";

      if (ticker.endsWith(".MI") || exchange.includes("BORSA ITALIANA") || exchange.includes("MIC")) {
        finalTicker = ticker.endsWith(".MI") ? ticker : ticker + ".MI";
      } else if (ticker.endsWith(".DE") || exchange === "XETRA") {
        finalTicker = ticker;
      } else if (exchange === "XETRA" && !ticker.endsWith(".DE")) {
        finalTicker = ticker + ".DE";
      } else {
        continue;
      }

      if (finalTicker && !seenTickers.has(finalTicker)) {
        suggestions.push({
          ticker: finalTicker,
          isin: item.isin || undefined,
          name: item.description,
          currency: currency,
        });
        seenTickers.add(finalTicker);
      }
    }

    console.log(`Found ${suggestions.length} XETRA/Milan results for "${query}"`);

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