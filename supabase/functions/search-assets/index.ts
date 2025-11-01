// Filtra solo MI (Milano) e DE (XETRA/Francoforte)
    const allowedExchanges = ["MI", "DE"];
    const filteredResults = results.filter((item: any) => 
      allowedExchanges.includes(item.Exchange)
    );

    const suggestions = filteredResults.map((item: any) => {
      let ticker = item.Code;
      const exchangeSuffix: Record<string, string> = {
        MI: ".MI", // Milano
        DE: ".DE", // XETRA (Germania)
      };

      if (item.Exchange && exchangeSuffix[item.Exchange]) {
        ticker = `${item.Code}${exchangeSuffix[item.Exchange]}`;
      }

      return {
        ticker: ticker,
        isin: item.ISIN || undefined,
        name: item.Name,
        currency: item.Currency || "EUR",
        exchange: item.Exchange, // Aggiungi l'exchange per debug
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