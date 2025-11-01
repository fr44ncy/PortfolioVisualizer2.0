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

    const EODHD_API_KEY = Deno.env.get("EODHD_API_KEY") || "demo";
    const apiUrl = `https://eodhistoricaldata.com/api/search/${encodeURIComponent(
      query
    )}?api_token=${EODHD_API_KEY}&fmt=json`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`EODHD API returned ${response.status}`);
    }

    const results = await response.json();

    if (!Array.isArray(results)) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Logga i primi risultati per debug
    console.log("Sample exchanges from API:", results.slice(0, 5).map((r: any) => r.Exchange));

    // Filtra solo MI (Milano) e DE (XETRA/Francoforte)
    // XETRA potrebbe essere "XETRA" invece di "DE"
    const allowedExchanges = ["MI", "DE", "XETRA", "F"];
    const filteredResults = results.filter((item: any) => 
      allowedExchanges.includes(item.Exchange)
    );

    console.log(`Found ${filteredResults.length} results from MI/DE/XETRA`);

    const suggestions = filteredResults.map((item: any) => {
      let ticker = item.Code;
      const exchangeSuffix: Record<string, string> = {
        MI: ".MI",       // Milano
        DE: ".DE",       // XETRA
        XETRA: ".DE",    // XETRA alternativo
        F: ".F",         // Frankfurt
      };

      if (item.Exchange && exchangeSuffix[item.Exchange]) {
        ticker = `${item.Code}${exchangeSuffix[item.Exchange]}`;
      }

      return {
        ticker: ticker,
        isin: item.ISIN || undefined,
        name: item.Name,
        currency: item.Currency || "EUR",
        exchange: item.Exchange,
      };
    });

    const uniqueTickers = new Set<string>();
    const uniqueSuggestions = suggestions.filter((s: any) => {
      if (uniqueTickers.has(s.ticker)) return false;
      uniqueTickers.add(s.ticker);
      return true;
    });

    // Restituisci TUTTI i risultati filtrati (senza limite)
    return new Response(JSON.stringify(uniqueSuggestions), {
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