import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
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

    // --- PALETTO OPZIONALE (vedi nota sotto) ---
    // Questo è un paletto, ma è utile per evitare query vuote.
    // Puoi rimuoverlo se vuoi permettere ricerche con meno di 2 caratteri.
    if (!query || query.length < 2) {
      return new Response(
        JSON.stringify({ error: "Query must be at least 2 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const finnhubKey = Deno.env.get("FINNHUB_API_KEY");
    if (!finnhubKey) {
      throw new Error("FINNHUB_API_KEY not configured");
    }

    console.log(`Searching Finnhub for: ${query}`);

    const apiUrl =
      `https://finnhub.io/api/v1/search?q=${
        encodeURIComponent(query)
      }&token=${finnhubKey}`;

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

    // Non più necessario, dato che non filtriamo solo per Europa
    // const europeanExchanges = ['XETRA', 'MIC', 'MILANEX'];
    const seenTickers = new Set<string>();
    const suggestions = [];

    for (const item of data.result) {
      if (!item.symbol || !item.description) {
        continue;
      }

      const ticker = item.symbol.toUpperCase();
      // const exchange = (item.exchange || "").toUpperCase(); // Non più necessario per il filtro

      // --- MODIFICA 1: RIMOZIONE FILTRO "PALETTO" ---
      // La logica complessa if/else if/else è stata rimossa.
      // Ora accettiamo qualsiasi risultato da Finnhub,
      // a patto che non l'abbiamo già aggiunto (controllo duplicati).
      
      if (!seenTickers.has(ticker)) {
        suggestions.push({
          ticker: ticker,
          isin: item.isin || undefined,
          name: item.description,
          // Abbiamo rimosso 'currency: "EUR"' perché non possiamo più
          // assumerlo. Aggiungiamo 'type' e 'displaySymbol'
          // da Finnhub per dare più contesto.
          type: item.type,
          displaySymbol: item.displaySymbol,
        });
        seenTickers.add(ticker);
      }
    }

    // Log aggiornato per riflettere la ricerca generica
    console.log(`Found ${suggestions.length} results for "${query}"`);

    // --- MODIFICA 2: RIMOZIONE LIMITE 15 RISULTATI ---
    // Restituiamo l'intero array di 'suggestions', non solo i primi 15
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
      },
    );
  }
});