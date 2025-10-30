// supabase/functions/search-assets/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// API key trovata nel tuo file EDGE_FUNCTIONS.md
// In produzione, è meglio usare Deno.env.get('EODHD_API_KEY')
const EODHD_API_KEY = '68fe793540ec48.53643271';

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Legge il 'query' dal body, come si aspetta src/lib/assetData.ts
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

    console.log(`Searching EODHD for: ${query}`);

    // API EODHD per la ricerca (come da EDGE_FUNCTIONS.md)
    const apiUrl = `https://eodhistoricaldata.com/api/search/${encodeURIComponent(query)}?api_token=${EODHD_API_KEY}&fmt=json&limit=10`;

    const response = await fetch(apiUrl);

    if (!response.ok) {
      throw new Error(`EODHD returned ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mappa i risultati nel formato AssetSuggestion
    // Nota: EODHD usa Code e Exchange per formare il ticker
    const suggestions = data
      .filter((item: any) => item.Code && item.Exchange && item.Currency && item.Name)
      .map((item: any) => ({
        // EODHD format: "Ticker.Exchange" (es. "EMIM.AS" o "AAPL.US")
        ticker: `${item.Code}.${item.Exchange}`, 
        isin: item.ISIN || undefined,
        name: item.Name,
        currency: item.Currency,
      }));
    
    console.log(`Found ${suggestions.length} results for "${query}"`);

    return new Response(JSON.stringify(suggestions), {
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