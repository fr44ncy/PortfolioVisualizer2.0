import { PricePoint, AssetSuggestion } from '../types';
import { supabase } from './supabase'; // Importa il client Supabase

/**
 * Mappa ISIN -> Ticker usata SOLO come fallback per la generazione
 * di dati sintetici se la ricerca API fallisce.
 */
export const ISIN_TO_TICKER: Record<string, string> = {
  'US0378331005': 'AAPL',
  'US5949181045': 'MSFT',
  'US02079K3059': 'GOOGL',
  'US0231351067': 'AMZN',
  'US88160R1014': 'TSLA',
  'IT0003132476': 'ENI.MI',
  'IE00B4L5Y983': 'IWDA.AS',
  'US0846707026': 'BRK.B',
  'US46625H1005': 'JPM',
  'US91324P1021': 'UNH',
  'IE00B0M62Q58': 'IWD.AS',
  'IE00B4L5Y999': 'IEMG.AS',
  'IE00B1FZS350': 'QQQ.L',
  'IE00B5BMR087': 'VUSA.AS',
  'IE00B3RBWM25': 'VEVE.AS',
  'US4642872000': 'SPY',
  'US78462F1030': 'PYPL',
  'GB00B03MLX29': 'HSBA.L',
  'US9311421039': 'V',
  'FR0000120271': 'BNP.PA',
  'DE000BASF111': 'BAS.DE',
  'JP3435000009': 'SONY',
  'CH0038863350': 'NESN.SW',
  'US78463V1070': 'GLD',
  'US78464Y4090': 'SLV',
  'US912810FH35': 'USO',
  'US912810JA50': 'UNG',
  'US4642882799': 'DBC',
  'CRYPTO:BTC': 'BTC',
  'CRYPTO:ETH': 'ETH',
};

/**
 * Database di parametri (Ritorno/Volatilità) usato SOLO come fallback
 * per la generazione di dati sintetici.
 */
export const ASSET_DATABASE: Record<string, { name: string; annualReturn: number; volatility: number; currency: string }> = {
  // Azioni
  'AAPL': { name: 'Apple Inc.', annualReturn: 0.20, volatility: 0.30, currency: 'USD' },
  'MSFT': { name: 'Microsoft Corp.', annualReturn: 0.18, volatility: 0.25, currency: 'USD' },
  'GOOGL': { name: 'Alphabet Inc.', annualReturn: 0.17, volatility: 0.28, currency: 'USD' },
  'AMZN': { name: 'Amazon.com Inc.', annualReturn: 0.16, volatility: 0.33, currency: 'USD' },
  'TSLA': { name: 'Tesla Inc.', annualReturn: 0.30, volatility: 0.60, currency: 'USD' },
  'ENI.MI': { name: 'Eni SpA', annualReturn: 0.05, volatility: 0.22, currency: 'EUR' },
  'IWDA.AS': { name: 'iShares MSCI World', annualReturn: 0.09, volatility: 0.16, currency: 'EUR' },
  'BRK.B': { name: 'Berkshire Hathaway', annualReturn: 0.14, volatility: 0.22, currency: 'USD' },
  'JPM': { name: 'JPMorgan Chase', annualReturn: 0.12, volatility: 0.28, currency: 'USD' },
  'UNH': { name: 'UnitedHealth Group', annualReturn: 0.15, volatility: 0.24, currency: 'USD' },

  // ETF
  'IWD.AS': { name: 'iShares MSCI World Value', annualReturn: 0.08, volatility: 0.18, currency: 'EUR' },
  'IEMG.AS': { name: 'iShares MSCI Emerging Markets', annualReturn: 0.10, volatility: 0.25, currency: 'USD' },
  'QQQ.L': { name: 'Invesco QQQ ETF', annualReturn: 0.19, volatility: 0.30, currency: 'USD' },
  'VUSA.AS': { name: 'Vanguard S&P 500 UCITS', annualReturn: 0.15, volatility: 0.20, currency: 'EUR' },
  'VEVE.AS': { name: 'Vanguard FTSE Developed Europe', annualReturn: 0.08, volatility: 0.16, currency: 'EUR' },
  'SPY': { name: 'SPDR S&P 500 ETF', annualReturn: 0.15, volatility: 0.22, currency: 'USD' },

  // Materie prime
  'GLD': { name: 'SPDR Gold Trust', annualReturn: 0.08, volatility: 0.18, currency: 'USD' },
  'SLV': { name: 'iShares Silver Trust', annualReturn: 0.06, volatility: 0.25, currency: 'USD' },
  'USO': { name: 'United States Oil Fund', annualReturn: 0.10, volatility: 0.45, currency: 'USD' },
  'UNG': { name: 'United States Natural Gas Fund', annualReturn: 0.12, volatility: 0.50, currency: 'USD' },
  'DBC': { name: 'Invesco Commodity Index', annualReturn: 0.07, volatility: 0.35, currency: 'USD' },

  // Crypto
  'BTC': { name: 'Bitcoin', annualReturn: 0.80, volatility: 0.90, currency: 'USD' },
  'ETH': { name: 'Ethereum', annualReturn: 0.75, volatility: 0.85, currency: 'USD' },
  'BNB': { name: 'Binance Coin', annualReturn: 0.60, volatility: 0.80, currency: 'USD' },
};

/**
 * Tassi di cambio (statici) per la conversione in EUR.
 * In un'app di produzione, anche questi dovrebbero essere recuperati via API.
 */
export const EXCHANGE_RATES: Record<string, { symbol: string; rateToEUR: number }> = {
  USD: { symbol: '$', rateToEUR: 0.92 },
  EUR: { symbol: '€', rateToEUR: 1 },
  GBP: { symbol: '£', rateToEUR: 1.15 },
  JPY: { symbol: '¥', rateToEUR: 0.0067 },
  CHF: { symbol: 'CHF', rateToEUR: 0.93 },
  AUD: { symbol: 'A$', rateToEUR: 0.62 },
  CAD: { symbol: 'C$', rateToEUR: 0.69 },
  NZD: { symbol: 'NZ$', rateToEUR: 0.58 },
  SEK: { symbol: 'kr', rateToEUR: 0.086 },
  NOK: { symbol: 'kr', rateToEUR: 0.089 },
  DKK: { symbol: 'kr', rateToEUR: 0.134 },
  SGD: { symbol: 'S$', rateToEUR: 0.67 },
  HKD: { symbol: 'HK$', rateToEUR: 0.12 }
};

/**
 * NUOVA FUNZIONE
 * Converte un valore da una valuta all'altra, usando EUR come pivot.
 */
export function getConversionRate(from: string, to: string): number {
  if (from === to) return 1;

  const rateFrom = EXCHANGE_RATES[from]?.rateToEUR;
  const rateTo = EXCHANGE_RATES[to]?.rateToEUR;

  if (!rateFrom || !rateTo) {
    console.warn(`Tasso di cambio non trovato per ${from} o ${to}. Uso 1.`);
    // Se una delle due valute è EUR e l'altra no, usa il tasso disponibile
    if (from === 'EUR' && rateTo) return 1 / rateTo;
    if (to === 'EUR' && rateFrom) return rateFrom;
    // Altrimenti non possiamo calcolare
    return 1;
  }

  // Tasso = (rateToEUR di FROM) / (rateToEUR di TO)
  // Es: da USD a GBP: (USD/EUR) / (GBP/EUR) = (0.92 / 1.15) = 0.8
  // Es: da EUR a USD: (EUR/EUR) / (USD/EUR) = (1 / 0.92) = 1.086
  return rateFrom / rateTo;
}


/**
 * Cerca asset (Ticker, ISIN, Nome) tramite Supabase Edge Function.
 */
export async function searchAssets(query: string): Promise<AssetSuggestion[]> {
  if (!query || query.length < 2) return [];

  try {
    // *** CORREZIONE: Invia i dati nel 'body' della richiesta POST ***
    const { data, error } = await supabase.functions.invoke('search-assets', {
      body: { query }
    });

    if (error) {
      throw new Error(`Errore Edge Function: ${error.message}`);
    }

    if (!Array.isArray(data)) {
      return [];
    }

    return data;

  } catch (e) {
    console.error(`Ricerca asset fallita: ${(e as Error).message}`);
    return [];
  }
}

// --- Funzioni per dati storici (API Alpha Vantage e Fallback Sintetico) ---

/**
 * Genera un numero casuale da una distribuzione normale (metodo Box-Muller).
 * Usato solo per i dati sintetici.
 */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Formatta un oggetto Date in 'YYYY-MM-DD'.
 */
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * FALLBACK: Genera una serie di prezzi sintetici (Geometric Brownian Motion).
 * Usato solo se l'API Alpha Vantage fallisce.
 */
export function generateSyntheticPrices(ticker: string, days: number = 365 * 3, currency: string = 'USD'): PricePoint[] {
  // Cerca i parametri nel database statico di fallback
  const assetParams = ASSET_DATABASE[ticker] || { annualReturn: 0.08, volatility: 0.18 };
  const mu = assetParams.annualReturn;
  const sigma = assetParams.volatility;
  const dt = 1 / 252; // Giorni di trading
  const startPrice = 100;
  const prices: PricePoint[] = [];
  let price = startPrice;
  const today = new Date();
  const startDate = new Date(today.getTime());
  startDate.setDate(today.getDate() - days);

  for (let i = 0; i <= days; i++) {
    const t = new Date(startDate.getTime());
    t.setDate(startDate.getDate() + i);
    const day = t.getDay(); // 0 = Domenica, 6 = Sabato
    if (day === 0 || day === 6) continue; // Salta i weekend

    const z = gaussianRandom();
    const drift = (mu - 0.5 * sigma * sigma) * dt;
    const diffusion = sigma * Math.sqrt(dt) * z;
    price = price * Math.exp(drift + diffusion);
    prices.push({
      date: formatDate(t),
      close: Number(price.toFixed(4)),
      currency: currency // Usa la valuta passata
    });
  }

  // Assicura che ci siano abbastanza dati (almeno ~400 giorni di trading per 2 anni)
  if (prices.length < 400 && days < 365 * 10) {
    return generateSyntheticPrices(ticker, days * 2, currency);
  }

  return prices;
}

/**
 * Scarica i dati storici dei prezzi tramite Supabase Edge Function.
 * Esegue il fallback a `generateSyntheticPrices` in caso di errore.
 * Restituisce un oggetto con i dati e un flag che indica se sono sintetici.
 */
export async function fetchPriceHistory(
  ticker: string,
  days: number = 365 * 5,
  currency: string = 'USD'
): Promise<{ data: PricePoint[], isSynthetic: boolean }> { // Tipo di ritorno modificato

  if (ticker.startsWith('CRYPTO:')) {
     console.warn(`Ticker Crypto ${ticker} non supportato, uso dati sintetici.`);
     // Restituisce dati sintetici con flag true
     return { data: generateSyntheticPrices(ticker, days, currency), isSynthetic: true };
  }

  try {
    const { data, error } = await supabase.functions.invoke('fetch-prices', {
      body: { ticker, currency }
    });

    if (error) {
      const errorMessage = (error.message || '').toLowerCase();
      if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
        throw new Error('API rate limit reached');
      }
      throw new Error(`Errore Edge Function: ${error.message}`);
    }

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Nessun dato ricevuto dalla Edge Function.');
    }

    console.log(`Dati reali caricati per ${ticker} da Edge Function.`);
    // Restituisce i dati reali con flag false
    return { data: data, isSynthetic: false };

  } catch (e) {
    console.warn(`fetchPriceHistory(${ticker}) fallito, ripiego su dati sintetici. Errore: ${(e as Error).message}`);
    // Restituisce dati sintetici con flag true in caso di errore
    return { data: generateSyntheticPrices(ticker, days, currency), isSynthetic: true };
  }
}