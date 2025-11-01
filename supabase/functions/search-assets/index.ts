// supabase/functions/search-assets/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// *** MODIFICA: Mappa per convertire i codici borsa di Yahoo in quelli di EODHD/nostri ***
// Yahoo usa "MIL" per Milano, "GER" per Xetra/Germania.
const yahooExchangeMap: Record<string, string> = {
  'MIL': 'MI',    // Milano
  'GER': 'DE',    // Germania (Xetra)
  'XET': 'XETRA', // Xetra (alternativo)
};
// Elenco dei codici Yahoo che vogliamo
const allowedYahooExchanges = Object.keys(yahooExchangeMap); // ['MIL', 'GER', 'XET']

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

    // *** MODIFICA: Usiamo l'API di ricerca di Yahoo Finance (più affidabile per le borse EU) ***
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

    // Filtra solo azioni ed ETF e SOLO dalle borse consentite
    const validTypes = ['EQUITY', 'ETF', 'MUTUALFUND'];
    
    const suggestions = data.quotes
      .filter((item: any) => 
        item.symbol && 
        item.shortname &&
        validTypes.includes(item.quoteType) &&
        // Filtra per le borse che ci interessano (MIL, GER, XET)
        item.exchange && allowedYahooExchanges.includes(item.exchange.toUpperCase())
      )
      .map((item: any) => {
        const exchangeCode = item.exchange.toUpperCase();
        // Converte il codice borsa di Yahoo (es. 'MIL') nel nostro formato (es. 'MI')
        const internalExchangeCode = yahooExchangeMap[exchangeCode] || exchangeCode;
        
        // Ricrea il ticker nel formato EODHD (usato dal resto dell'app)
        const ticker = `${item.symbol.replace(`.${exchangeCode}`, '')}.${internalExchangeCode}`;

        return {
          ticker: ticker,
          isin: undefined, // Yahoo Search non fornisce ISIN
          name: item.shortname || item.longname || item.symbol,
          currency: item.currency || 'EUR', // Assumiamo EUR per queste borse
        };
      });

    console.log(`Found ${suggestions.length} results for "${query}" on MI, XETRA, DE`);

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