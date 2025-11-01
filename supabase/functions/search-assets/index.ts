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

    // *** MODIFICA: Aumentato il limite a 50 ***
    // Questo ci dà molti più risultati da cui filtrare (LSE, US, ecc.)
    const apiUrl = `https://eodhistoricaldata.com/api/search/${encodeURIComponent(query)}?api_token=${EODHD_API_KEY}&fmt=json&limit=50`;

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

    // Filtro per le borse consentite (Milano, Xetra, Francoforte)
    // EODHD usa 'MI' per Milano e 'XETRA' o 'DE' per la Germania
    const allowedExchanges = ['MI', 'XETRA', 'DE'];
    
    const suggestions = data
      .filter((item: any) => 
        item.Code && 
        item.Exchange && 
        item.Currency && 
        item.Name &&
        // Applica il filtro sull'array completo di 50 risultati
        allowedExchanges.includes(item.Exchange.toUpperCase())
      )
      .map((item: any) => ({
        // Formato EODHD: "Ticker.Exchange" (es. "EMIM.MI" o "EUNL.DE")
        ticker: `${item.Code}.${item.Exchange}`, 
        isin: item.ISIN || undefined,
        name: item.Name,
        currency: item.Currency, // Sarà EUR per queste borse
      }));
    
    console.log(`Found ${suggestions.length} results for "${query}" on MI, XETRA, DE (out of ${data.length} total fetched)`);

    // Restituisce i risultati filtrati (massimo 10 per la UI)
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