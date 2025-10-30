// src/lib/portfolioCalculations.ts

import { Asset, PricePoint, NavPoint, PortfolioMetrics } from '../types';
// *** MODIFICA: Importa getConversionRate e EXCHANGE_RATES ***
import { EXCHANGE_RATES, getConversionRate } from './assetData';

/**
 * Formatta un valore numerico in una stringa di valuta (es. €1.2M, $120k).
 * La valuta di default è EUR.
 */
export function formatCurrency(value: number, currency: string = 'EUR'): string {
  // *** MODIFICA: Usa il simbolo corretto dalla valuta target ***
  const symbol = EXCHANGE_RATES[currency]?.symbol || currency;
  const abs = Math.abs(Number(value));
  if (abs >= 1e9) return symbol + (value / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return symbol + (value / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return symbol + (value / 1e3).toFixed(0) + 'k';
  return symbol + Number(value).toFixed(2);
}

/**
 * Calcola la serie storica del Valore Netto dell'Attivo (NAV) del portfolio.
 * Converte tutte le valute nella valuta 'currency' (target) per il calcolo.
 */
export function computeNavSeries(
  pricesData: Record<string, PricePoint[]>,
  assets: Asset[],
  initialCapital: number,
  currency: string // <-- Questa è la valuta TARGET (es. 'USD', 'EUR')
): NavPoint[] {
  const tickers = assets.map(a => a.ticker).filter(Boolean);
  if (tickers.length === 0) return [];

  // 1. Trova la data di inizio comune (la data più recente tra le date di inizio di tutti gli asset)
  const firstDates = tickers
    .map(t => (pricesData[t] || []).length ? pricesData[t][0].date : null)
    .filter(Boolean) as string[];

  if (firstDates.length === 0) return [];

  const commonStart = firstDates.sort().reverse()[0];

  // 2. Crea un set di tutte le date di trading uniche da quel punto in poi
  const dateSet = new Set<string>();
  tickers.forEach(t => {
    (pricesData[t] || []).forEach(p => {
      if (p.date >= commonStart) dateSet.add(p.date);
    });
  });

  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  // 3. Calcola il numero di "azioni" (quote) per ogni asset in base al capitale iniziale e al peso
  const shares: Record<string, number> = {};
  assets.forEach(asset => {
    const t = asset.ticker;
    if (!t) return;
    const arr = pricesData[t] || [];
    let rec = arr.find(r => r.date === commonStart);
    
    // *** INIZIO CORREZIONE: Cerca la data o la prima successiva ***
    // Se non trova il prezzo esatto alla data di inizio, cerca il primo prezzo
    // disponibile *a partire da* (maggiore o UGUALE) quella data.
    if (!rec) rec = arr.find(r => r.date >= commonStart);
    // *** FINE CORREZIONE ***
    
    if (rec) {
      // *** MODIFICA: Converti nella valuta TARGET (non EUR) ***
      const assetCurrency = asset.currency || rec.currency || 'USD';
      const rate = getConversionRate(assetCurrency, currency); // da Nativa -> a Target
      const priceInTargetCurrency = rec.close * rate;
      const alloc = (asset.weight / 100) * initialCapital;
      shares[t] = priceInTargetCurrency > 0 ? alloc / priceInTargetCurrency : 0;
    } else {
      shares[t] = 0; // Nessun dato di prezzo trovato
    }
  });

  // 4. Calcola il valore totale (NAV) del portfolio per ogni giorno
  const series = dates.map(date => {
    let total = 0;
    assets.forEach(asset => {
      const t = asset.ticker;
      if (!t) return;
      const arr = pricesData[t] || [];
      
      // Trova il prezzo più recente per quella data (gestione "forward fill" per giorni mancanti)
      let rec = arr.find(r => r.date === date);
      if (!rec) {
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i].date <= date) {
            rec = arr[i];
            break;
          }
        }
      }
      
      if (rec) {
        // *** MODIFICA: Converti nella valuta TARGET (non EUR) ***
        const assetCurrency = asset.currency || rec.currency || 'USD';
        const rate = getConversionRate(assetCurrency, currency); // da Nativa -> a Target
        const priceInTargetCurrency = rec.close * rate;
        const s = shares[t] || 0;
        total += s * priceInTargetCurrency;
      }
    });
    return { date, nav: Number(total.toFixed(2)) };
  });

  // 5. Scala la serie per iniziare esattamente dal capitale iniziale (normalizzazione)
  if (series.length > 0 && series[0].nav > 0) {
    const factor = initialCapital / series[0].nav;
    const scaled = series.map(s => ({ date: s.date, nav: Number((s.nav * factor).toFixed(2)) }));
    return scaled.filter(s => s.nav > 0);
  }

  return series.filter(s => s.nav > 0);
}

/**
 * Calcola i ritorni giornalieri da una serie NAV.
 */
function dailyReturns(series: NavPoint[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    returns.push(series[i].nav / series[i - 1].nav - 1);
  }
  return returns;
}

// --- Funzioni di utilità statistica ---

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

/**
 * Calcola le metriche di performance chiave dalla serie NAV.
 */
export function calculateMetrics(navSeries: NavPoint[]): PortfolioMetrics {
  if (navSeries.length < 2) {
    return {
      annualReturn: null,
      annualVol: null,
      sharpe: null,
      var95: null,
      cvar95: null,
      finalValue: null
    };
  }

  const daily = dailyReturns(navSeries);
  const dailyStd = std(daily);

  const start = navSeries[0].nav;
  const end = navSeries[navSeries.length - 1].nav;
  // Assumiamo 252 giorni di trading all'anno
  const years = (navSeries.length - 1) / 252 || 1; 

  const annReturn = Math.pow(end / start, 1 / years) - 1;
  const annVol = dailyStd * Math.sqrt(252);
  // Assumiamo un risk-free rate del 2% per lo Sharpe Ratio
  const sharpeRatio = (annReturn - 0.02) / (annVol || 1e-9); 

  // Calcola VaR e CVaR storici basati sui rendimenti rolling a 1 anno
  const rolling: number[] = [];
  const window = 252; // 1 anno di trading
  if (navSeries.length >= window) {
    for (let i = window; i < navSeries.length; i++) {
      rolling.push(navSeries[i].nav / navSeries[i - window].nav - 1);
    }
  }

  let var_hist = null;
  let cvar_hist = null;
  if (rolling.length > 0) {
    const sorted = [...rolling].sort((a, b) => a - b);
    const idx = Math.floor(0.05 * sorted.length); // Indice per il 5° percentile
    const p95 = sorted[Math.max(0, idx)];
    var_hist = -p95; // Value at Risk
    
    const worst = sorted.slice(0, idx + 1); // Prende il 5% peggiore
    const avgWorst = worst.reduce((s, x) => s + x, 0) / worst.length;
    cvar_hist = -avgWorst; // Conditional Value at Risk
  }

  return {
    annualReturn: annReturn,
    annualVol: annVol,
    sharpe: sharpeRatio,
    var95: var_hist,
    cvar95: cvar_hist,
    finalValue: end
  };
}

/**
 * Calcola i dati per il grafico dei rendimenti per anno solare.
 */
export function calculateAnnualReturns(
  navSeries: NavPoint[],
): { year: string; return: number }[] {
  if (navSeries.length === 0) return [];

  // 1. Raggruppa i dati per anno solare
  const returnsByYear: Record<string, { start: number; end: number; endDate: string }> = {};

  for (const point of navSeries) {
    const year = point.date.substring(0, 4);
    if (!returnsByYear[year]) {
      // È il primo dato che vediamo per quest'anno
      returnsByYear[year] = { start: point.nav, end: point.nav, endDate: point.date };
    } else {
      // Aggiorna l'ultimo NAV per quest'anno
      returnsByYear[year].end = point.nav;
      returnsByYear[year].endDate = point.date;
    }
  }

  const annualReturns: { year: string; return: number }[] = [];
  
  // 2. Converti in un array e calcola i ritorni per ogni anno
  for (const year in returnsByYear) {
    const data = returnsByYear[year];
    // Calcola il ritorno di quest'anno (NAV finale / NAV iniziale - 1)
    const yearReturn = (data.end / data.start) - 1;
    annualReturns.push({ year: year, return: yearReturn });
  }
  
  return annualReturns;
}