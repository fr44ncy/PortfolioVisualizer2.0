// src/lib/portfolioCalculations.ts

import { Asset, PricePoint, NavPoint, PortfolioMetrics } from '../types';
import { EXCHANGE_RATES, getConversionRate } from './assetData';

/**
 * Formatta un valore numerico in una stringa di valuta (es. €1.2M, $120k).
 */
export function formatCurrency(value: number, currency: string = 'EUR'): string {
  const symbol = EXCHANGE_RATES[currency]?.symbol || currency;
  const abs = Math.abs(Number(value));
  if (abs >= 1e9) return symbol + (value / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return symbol + (value / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return symbol + (value / 1e3).toFixed(0) + 'k';
  return symbol + Number(value).toFixed(2);
}

/**
 * Helper per trovare il prezzo più vicino a una data (forward-fill).
 */
function findPriceByDate(date: string, series: PricePoint[]): PricePoint | null {
  if (!series || series.length === 0) return null;
  
  let bestMatch = null;
  // Cerca la data esatta o l'ultima precedente
  for (const point of series) {
    if (point.date <= date) {
      bestMatch = point;
    } else {
      break; // Le serie sono ordinate, possiamo fermarci
    }
  }
  return bestMatch;
}

/**
 * Calcola la serie storica del Valore Netto dell'Attivo (NAV) del portfolio.
 * *** Questa versione include l'impatto storico del cambio (FX-adjusted) ***
 */
export function computeNavSeries(
  pricesData: Record<string, PricePoint[]>,
  fxData: Record<string, PricePoint[]>, // Dati storici FX (es. 'USD-EUR')
  assets: Asset[],
  initialCapital: number,
  targetCurrency: string // Valuta del portfolio (es. 'EUR')
): NavPoint[] {
  
  const tickers = assets.map(a => a.ticker).filter(Boolean);
  if (tickers.length === 0) return [];

  // 1. Trova la data di inizio comune (la data più recente tra le date di inizio di tutti gli asset E tassi FX)
  let firstDates: string[] = [];
  
  tickers.forEach(t => {
    const series = pricesData[t] || [];
    if (series.length > 0) firstDates.push(series[0].date);
  });
  
  assets.forEach(asset => {
    if (asset.currency !== targetCurrency) {
      const pair = `${asset.currency}-${targetCurrency}`;
      const series = fxData[pair] || [];
      if (series.length > 0) firstDates.push(series[0].date);
    }
  });

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

  // 3. Calcola il numero di "azioni" (quote) per ogni asset
  // Questo si basa sul capitale INIZIALE e sui tassi di cambio INIZIALI
  const shares: Record<string, number> = {};
  
  assets.forEach(asset => {
    const t = asset.ticker;
    if (!t) return;
    
    const assetPriceSeries = pricesData[t] || [];
    const initialPricePt = findPriceByDate(commonStart, assetPriceSeries);
    if (!initialPricePt) {
      console.warn(`Nessun prezzo iniziale per ${t} a ${commonStart}`);
      shares[t] = 0;
      return;
    }
    const priceInNativeCcy = initialPricePt.close;

    // Calcola l'allocazione in valuta target
    const allocationInTargetCcy = (asset.weight / 100) * initialCapital;

    let priceInTargetCcy = 0;

    if (asset.currency === targetCurrency) {
      priceInTargetCcy = priceInNativeCcy;
    } else {
      // Trova il tasso di cambio INIZIALE
      const pair = `${asset.currency}-${targetCurrency}`;
      const fxSeries = fxData[pair] || [];
      const initialFxPt = findPriceByDate(commonStart, fxSeries);
      
      if (!initialFxPt) {
        console.warn(`Nessun tasso FX iniziale per ${pair} a ${commonStart}`);
        shares[t] = 0;
        return;
      }
      priceInTargetCcy = priceInNativeCcy * initialFxPt.close;
    }

    shares[t] = priceInTargetCcy > 0 ? allocationInTargetCcy / priceInTargetCcy : 0;
  });

  // 4. Calcola il valore totale (NAV) del portfolio per ogni giorno
  // *** Usando i tassi di cambio STORICI ***
  const series = dates.map(date => {
    let totalNavInTargetCcy = 0;
    
    assets.forEach(asset => {
      const t = asset.ticker;
      if (!t || !shares[t]) return;

      // Trova il prezzo dell'asset per la data corrente
      const assetPricePt = findPriceByDate(date, pricesData[t]);
      if (!assetPricePt) return; // Salta se mancano dati per questo asset
      
      const priceInNativeCcy = assetPricePt.close;
      let valueInTargetCcy = 0;

      if (asset.currency === targetCurrency) {
        valueInTargetCcy = shares[t] * priceInNativeCcy;
      } else {
        // Trova il tasso di cambio per la data corrente
        const pair = `${asset.currency}-${targetCurrency}`;
        const fxPt = findPriceByDate(date, fxData[pair]);
        if (!fxPt) return; // Salta se mancano dati FX per questo giorno
        
        const fxRate = fxPt.close;
        valueInTargetCcy = shares[t] * (priceInNativeCcy * fxRate);
      }
      
      totalNavInTargetCcy += valueInTargetCcy;
    });

    return { date, nav: Number(totalNavInTargetCcy.toFixed(2)) };
  });

  // 5. Filtra i giorni in cui il NAV era 0 (prima che tutti gli asset avessero dati)
  const validSeries = series.filter(s => s.nav > 0);
  if (validSeries.length === 0) return [];

  // 6. Scala la serie per iniziare esattamente dal capitale iniziale (normalizzazione)
  const firstNav = validSeries[0].nav;
  if (firstNav > 0) {
    const factor = initialCapital / firstNav;
    const scaled = validSeries.map(s => ({ 
      date: s.date, 
      nav: Number((s.nav * factor).toFixed(2)) 
    }));
    return scaled;
  }

  return validSeries;
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
  
  // Calcola gli anni basandoti sulle date effettive per maggior precisione
  const startDate = new Date(navSeries[0].date);
  const endDate = new Date(navSeries[navSeries.length - 1].date);
  const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25) || 1;

  const annReturn = Math.pow(end / start, 1 / years) - 1;
  const annVol = dailyStd * Math.sqrt(252); // Assumiamo 252 giorni di trading
  // Assumiamo un risk-free rate del 2% per lo Sharpe Ratio
  const sharpeRatio = (annReturn - 0.02) / (annVol || 1e-9); 

  const rolling: number[] = [];
  const window = 252;

  if (navSeries.length >= window) {
    for (let i = window; i < navSeries.length; i++) {
        const currentNav = navSeries[i].nav;
        const prevNav = navSeries[i - window].nav;

        if (currentNav && prevNav && prevNav > 0) {
            rolling.push(currentNav / prevNav - 1);
        }
    }
  }

  let var_hist = null;
  let cvar_hist = null;

  if (rolling.length > 10) {
    const sorted = [...rolling].sort((a, b) => a - b);
    const idx = Math.max(0, Math.floor(0.05 * sorted.length));
    const p5 = sorted[idx];
    var_hist = Math.abs(p5);

    const worst = sorted.slice(0, Math.max(1, idx + 1));
    const avgWorst = worst.reduce((s, x) => s + x, 0) / worst.length;
    cvar_hist = Math.abs(avgWorst);
  } else if (daily.length > 50) {
      const sortedDaily = [...daily].sort((a, b) => a - b);
      const idxDaily = Math.max(0, Math.floor(0.05 * sortedDaily.length));
      const p5Daily = sortedDaily[idxDaily];
      var_hist = Math.abs(p5Daily) * Math.sqrt(252);

      const worstDaily = sortedDaily.slice(0, Math.max(1, idxDaily + 1));
      const avgWorstDaily = worstDaily.reduce((s, x) => s + x, 0) / worstDaily.length;
      cvar_hist = Math.abs(avgWorstDaily) * Math.sqrt(252);
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