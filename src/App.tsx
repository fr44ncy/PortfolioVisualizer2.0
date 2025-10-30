// src/App.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  AlertCircle,
  Save,
  BookMarked,
  LogOut,
  Loader2,
  User,
} from 'lucide-react';
import { Asset, NavPoint, PricePoint, PortfolioMetrics } from './types';
import PortfolioComposition from './components/PortfolioComposition';
import PortfolioChart from './components/PortfolioChart';
import ReturnsHistogram from './components/ReturnsHistogram';
import MetricsCard from './components/MetricsCard';
import AuthModal from './components/AuthModal'; 
import SavedPortfoliosModal from './components/SavedPortfoliosModal';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
// *** MODIFICA: Importa fetchFxHistory e EXCHANGE_RATES ***
import { fetchPriceHistory, fetchFxHistory, EXCHANGE_RATES } from './lib/assetData';
import {
  computeNavSeries,
  calculateMetrics,
  calculateAnnualReturns,
} from './lib/portfolioCalculations';

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const emptyMetrics: PortfolioMetrics = {
  annualReturn: null,
  annualVol: null,
  sharpe: null,
  var95: null,
  cvar95: null,
  finalValue: null,
};

// *** MODIFICA: Cache separate per prezzi e FX ***
type PriceCache = Record<string, { data: PricePoint[]; timestamp: number }>;

export default function App() {
  // --- STATI ---
  const [assets, setAssets] = useState<Asset[]>([]);
  const [currency, setCurrency] = useState<string>('EUR');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [backtestYears, setBacktestYears] = useState<number>(5);
  const [scale, setScale] = useState<'linear' | 'log'>('linear');
  const [navSeries, setNavSeries] = useState<NavPoint[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics>(emptyMetrics);
  const [histogramData, setHistogramData] = useState<
    { year: string; return: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // --- STATI AUTH ---
  const [session, setSession] = useState<Session | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [portfolioName, setPortfolioName] = useState('Il Mio Portafoglio');

  // *** MODIFICA: Due cache separate ***
  const priceCache = useRef<PriceCache>({});
  const fxCache = useRef<PriceCache>({});
  const CACHE_TTL = 1000 * 60 * 60; // 1 ora

  // --- GESTIONE AUTH (Invariato) ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        setShowAuthModal(false);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // --- FUNZIONI AUTH E CRUD (Invariate) ---
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSavePortfolio = async () => {
    if (!session?.user) {
      setShowAuthModal(true);
      return;
    }
    if (assets.length === 0) {
      alert('Aggiungi almeno un asset prima di salvare.');
      return;
    }
    const name = window.prompt('Dai un nome al tuo portafoglio:', portfolioName);
    if (!name) return;
    setIsSaving(true);
    try {
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolios')
        .insert({
          name: name,
          user_id: session.user.id,
          currency: currency,
          initial_capital: initialCapital,
        })
        .select()
        .single();
      if (portfolioError) throw portfolioError;
      const assetsToSave = assets.map((asset) => ({
        portfolio_id: portfolioData.id,
        ticker: asset.ticker,
        isin: asset.isin,
        weight: asset.weight,
        currency: asset.currency,
      }));
      const { error: assetsError } = await supabase
        .from('portfolio_assets')
        .insert(assetsToSave);
      if (assetsError) throw assetsError;
      setPortfolioName(name);
      alert(`Portafoglio "${name}" salvato con successo!`);
    } catch (error: any) {
      alert(`Errore nel salvataggio: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadPortfolio = (
    loadedAssets: Asset[],
    config: { capital: number; currency: string; name: string }
  ) => {
    const assetsWithLocalIds = loadedAssets.map((asset) => ({
      ...asset,
      id: uid(),
    }));
    setAssets(assetsWithLocalIds);
    setInitialCapital(config.capital);
    setCurrency(config.currency);
    setPortfolioName(config.name);
    setShowLoadModal(false);
  };
  
  // --- FUNZIONI GESTIONE ASSET (Invariate) ---
  const handleAddAsset = (
    ticker: string,
    isin: string | undefined,
    currency: string
  ) => {
    const newAsset: Asset = {
      id: uid(),
      ticker,
      isin,
      weight: 10,
      currency,
    };
    if (!assets.some((a) => a.ticker === ticker)) {
      setAssets((prev) => [...prev, newAsset]);
    }
  };

  const handleRemoveAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateWeight = (id: string, weight: number) => {
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, weight: Math.max(0, Math.min(100, weight)) } : a
      )
    );
  };

  // --- USE EFFECT (Logica di calcolo PRINCIPALE) ---
  useEffect(() => {
    const calculatePortfolio = async () => {
      if (assets.length === 0) {
        setNavSeries([]);
        setMetrics(emptyMetrics);
        setHistogramData([]);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);

      try {
        const days = backtestYears * 365;
        const priceData: Record<string, PricePoint[]> = {};
        const fxData: Record<string, PricePoint[]> = {};
        const now = Date.now();

        // 1. Scarica i prezzi degli ASSET
        for (const asset of assets) {
          if (!asset.ticker) continue;
          // La chiave cache dipende solo dall'asset e dal periodo
          const key = `${asset.ticker}_${asset.currency}_${days}`;
          const cached = priceCache.current[key];
          
          if (cached && now - cached.timestamp < CACHE_TTL) {
            priceData[asset.ticker] = cached.data;
          } else {
            const result = await fetchPriceHistory(
              asset.ticker,
              days,
              asset.currency
            );
            if (!result.data || result.data.length === 0) {
              throw new Error(`Nessun dato disponibile per ${asset.ticker}.`);
            }
            priceCache.current[key] = { data: result.data, timestamp: now };
            priceData[asset.ticker] = result.data;
          }
        }

        // 2. Scarica le serie storiche FX necessarie
        const requiredFxPairs = new Set<string>(
          assets.map(a => `${a.currency}-${currency}`) // es. "USD-EUR"
        );
        
        for (const pair of requiredFxPairs) {
          const [from, to] = pair.split('-');
          if (from === to) continue; // Non serve scaricare EUR-EUR

          const fxKey = `${pair}_${days}`;
          const cachedFx = fxCache.current[fxKey];

          if (cachedFx && now - cachedFx.timestamp < CACHE_TTL) {
            fxData[pair] = cachedFx.data;
          } else {
            const fxSeries = await fetchFxHistory(from, to, days);
            if (fxSeries.length === 0) {
              throw new Error(`Dati FX non disponibili per ${pair}.`);
            }
            fxCache.current[fxKey] = { data: fxSeries, timestamp: now };
            fxData[pair] = fxSeries;
          }
        }

        // 3. Calcola il portfolio
        const series = computeNavSeries(
          priceData,
          fxData, // Passa i dati FX storici
          assets,
          initialCapital,
          currency // Valuta target
        );
        
        if (series.length < 2) {
          throw new Error('Dati insufficienti per il calcolo. Prova un periodo più lungo.');
        }

        setNavSeries(series);
        const calculatedMetrics = calculateMetrics(series);
        setMetrics(calculatedMetrics);
        
        const annualReturnsData = calculateAnnualReturns(series);
        setHistogramData(annualReturnsData);

      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Errore sconosciuto';
        console.error('Errore calcolo portfolio:', errorMessage);
        setError(errorMessage);
        setNavSeries([]);
        setMetrics(emptyMetrics);
        setHistogramData([]);
      } finally {
        setLoading(false);
      }
    };

    calculatePortfolio();
  }, [assets, initialCapital, backtestYears, currency]); // Ora 'currency' triggera un ricalcolo completo

  // --- RENDER (Invariato, ma ora le metriche cambieranno) ---
  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              {/* Logo e Titolo */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Portfolio Analyzer
                  </h1>
                </div>
              </div>

              {/* Controlli e Auth (Zona Account) */}
              <div className="flex items-center gap-2">
                
                {/* Controlli Portfolio */}
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <label className="text-sm text-gray-700 font-medium">Capitale</label>
                  <input
                    type="number"
                    value={initialCapital}
                    onChange={(e) => setInitialCapital(Number(e.target.value))}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <label className="text-sm text-gray-700 font-medium">Periodo</label>
                  <select
                    value={backtestYears}
                    onChange={(e) => setBacktestYears(Number(e.target.value))}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value={1}>1 anno</option>
                    <option value={2}>2 anni</option>
                    <option value={3}>3 anni</option>
                    <option value={5}>5 anni</option>
                    <option value={10}>10 anni</option>
                    <option value={15}>15 anni</option>
                    <option value={20}>20 anni</option>
                    <option value={30}>30 anni</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <label className="text-sm text-gray-700 font-medium">Valuta</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="EUR">EUR €</option>
                    <option value="USD">USD $</option>
                    <option value="GBP">GBP £</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>

                {/* Zona Account (Auth) */}
                <div className="h-10 border-l border-gray-200 mx-3"></div>

                {!session ? (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50"
                  >
                    <User className="w-4 h-4" />
                    Accedi per Salvare
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-medium text-gray-800">
                        {session.user.email?.split('@')[0]}
                      </div>
                      <div className="text-xs text-gray-500">
                        {session.user.email}
                      </div>
                    </div>
                    
                    <button
                      onClick={handleSavePortfolio}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSaving ? (
                         <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                         <Save className="w-4 h-4" />
                      )}
                      Salva
                    </button>
                    
                    <button
                      onClick={() => setShowLoadModal(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50"
                    >
                      <BookMarked className="w-4 h-4" />
                      Portafogli
                    </button>

                    <button
                      onClick={handleLogout}
                      title="Logout"
                      className="p-2 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}

              </div>
            </div>
            
            <div className="flex justify-end mt-4">
               <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                  <label className="text-sm text-gray-700 font-medium">Scala Grafico</label>
                  <select
                    value={scale}
                    onChange={(e) => setScale(e.target.value as 'linear' | 'log')}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="linear">Lineare</option>
                    <option value="log">Logaritmica</option>
                  </select>
                </div>
            </div>

          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-1">
              <PortfolioComposition
                assets={assets}
                onAddAsset={handleAddAsset}
                onRemoveAsset={handleRemoveAsset}
                onUpdateWeight={handleUpdateWeight}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Valore Portfolio: {portfolioName}
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Performance storica in {currency} negli ultimi {backtestYears}{' '}
                      {backtestYears === 1 ? 'anno' : 'anni'}
                    </p>
                  </div>
                  {metrics.annualReturn !== null && (
                    <div className="text-right bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-3 rounded-xl border border-blue-200">
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                        Rendimento Annuo ({currency})
                      </div>
                      <div
                        className={`text-2xl font-bold mt-1 ${
                          metrics.annualReturn >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {metrics.annualReturn >= 0 ? '+' : ''}
                        {(metrics.annualReturn * 100).toFixed(2)}%
                      </div>
                    </div>
                  )}
                </div>
                {error && (
                  <div className="flex items-start gap-3 text-sm px-5 py-4 rounded-xl mb-4 bg-red-50 text-red-700 border border-red-200">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">
                        Errore nel caricamento dati
                      </div>
                      <div className="text-xs mt-1">{error}</div>
                    </div>
                  </div>
                )}
                {loading ? (
                  <div className="h-80 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <div className="text-center">
                      <div className="inline-block w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <div className="text-sm font-medium text-gray-700">
                        Caricamento dati di mercato e FX...
                      </div>
                    </div>
                  </div>
                ) : (
                  <PortfolioChart
                    data={navSeries}
                    currency={currency}
                    scale={scale}
                  />
                )}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <MetricsCard
                  title="Rendimento Annuo"
                  value={
                    metrics.annualReturn !== null
                      ? `${metrics.annualReturn >= 0 ? '+' : ''}${(
                          metrics.annualReturn * 100
                        ).toFixed(2)}%`
                      : '—'
                  }
                  trend={
                    metrics.annualReturn !== null && metrics.annualReturn >= 0
                      ? 'positive'
                      : 'negative'
                  }
                />
                <MetricsCard
                  title="Volatilità"
                  value={
                    metrics.annualVol !== null
                      ? `${(metrics.annualVol * 100).toFixed(2)}%`
                      : '—'
                  }
                />
                <MetricsCard
                  title="Sharpe Ratio"
                  value={
                    metrics.sharpe !== null ? metrics.sharpe.toFixed(2) : '—'
                  }
                  trend={
                    metrics.sharpe !== null && metrics.sharpe > 1
                      ? 'positive'
                      : 'neutral'
                  }
                />
                <MetricsCard
                  title="VaR (1Y, 95%)"
                  value={
                    metrics.var95 !== null
                      ? `${(metrics.var95 * 100).toFixed(2)}%`
                      : '—'
                  }
                />
                <MetricsCard
                  title="CVaR (95%)"
                  value={
                    metrics.cvar95 !== null
                      ? `${(metrics.cvar95 * 100).toFixed(2)}%`
                      : '—'
                  }
                />
                <MetricsCard
                  title="Valore Finale"
                  value={
                    metrics.finalValue !== null
                      ? 
                      `${
                          EXCHANGE_RATES[currency]?.symbol || currency
                        }${(metrics.finalValue / 1000).toFixed(1)}k`
                      : '—'
                  }
                />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Rendimenti Anno per Anno
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Performance del portfolio per ogni anno solare (in {currency})
            </p>
            {loading ? (
              <div className="h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                <div className="text-sm text-gray-500">Caricamento...</div>
              </div>
            ) : (
              <ReturnsHistogram data={histogramData} />
            )}
          </div>
          <footer className="mt-8 text-center text-sm text-gray-600 bg-white rounded-xl py-4 border border-gray-200">
            <p className="font-medium">
              Dati forniti da EODHD (Ricerca) e Yahoo Finance (Prezzi)
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Solo dati reali di mercato • Aggiornati giornalmente
            </p>
          </footer>
        </main>
      </div>

      <SavedPortfoliosModal
        show={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadPortfolio}
      />
      
      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} />
      )}
    </>
  );
}