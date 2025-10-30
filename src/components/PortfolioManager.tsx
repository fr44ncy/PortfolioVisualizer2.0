import React, { useState, useEffect } from 'react';
import { Save, FolderOpen, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Asset } from '../types';

interface Portfolio {
  id: string;
  name: string;
  currency: string;
  initial_capital: number;
  created_at: string;
}

interface PortfolioManagerProps {
  currentAssets: Asset[];
  currentCurrency: string;
  currentCapital: number;
  onLoadPortfolio: (assets: Asset[], currency: string, capital: number) => void;
}

export default function PortfolioManager({
  currentAssets,
  currentCurrency,
  currentCapital,
  onLoadPortfolio
}: PortfolioManagerProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [portfolioName, setPortfolioName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    let sid = localStorage.getItem('portfolio_session_id');
    if (!sid) {
      sid = `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('portfolio_session_id', sid);
    }
    setSessionId(sid);
    loadPortfolios(sid);
  }, []);

  const loadPortfolios = async (sid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('portfolios')
        .select('*')
        .eq('session_id', sid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolios(data || []);
    } catch (error) {
      console.error('Error loading portfolios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!portfolioName.trim()) return;
    if (currentAssets.length === 0) {
      alert('Aggiungi almeno un asset prima di salvare');
      return;
    }

    setLoading(true);
    try {
      const { data: portfolio, error: portfolioError } = await supabase
        .from('portfolios')
        .insert({
          session_id: sessionId,
          name: portfolioName,
          currency: currentCurrency,
          initial_capital: currentCapital
        })
        .select()
        .single();

      if (portfolioError) throw portfolioError;

      const assetsToInsert = currentAssets.map(asset => ({
        portfolio_id: portfolio.id,
        ticker: asset.ticker,
        isin: asset.isin,
        weight: asset.weight,
        currency: asset.currency
      }));

      const { error: assetsError } = await supabase
        .from('portfolio_assets')
        .insert(assetsToInsert);

      if (assetsError) throw assetsError;

      setPortfolioName('');
      setIsSaveModalOpen(false);
      loadPortfolios(sessionId);
    } catch (error) {
      console.error('Error saving portfolio:', error);
      alert('Errore nel salvataggio del portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = async (portfolioId: string) => {
    setLoading(true);
    try {
      const { data: portfolio, error: portfolioError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('id', portfolioId)
        .single();

      if (portfolioError) throw portfolioError;

      const { data: assets, error: assetsError } = await supabase
        .from('portfolio_assets')
        .select('*')
        .eq('portfolio_id', portfolioId);

      if (assetsError) throw assetsError;

      const loadedAssets: Asset[] = assets.map(asset => ({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        ticker: asset.ticker,
        isin: asset.isin,
        weight: asset.weight,
        currency: asset.currency
      }));

      onLoadPortfolio(loadedAssets, portfolio.currency, portfolio.initial_capital);
      setIsOpen(false);
    } catch (error) {
      console.error('Error loading portfolio:', error);
      alert('Errore nel caricamento del portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (portfolioId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo portfolio?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('portfolios')
        .delete()
        .eq('id', portfolioId);

      if (error) throw error;
      loadPortfolios(sessionId);
    } catch (error) {
      console.error('Error deleting portfolio:', error);
      alert('Errore nell\'eliminazione del portfolio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setIsSaveModalOpen(true)}
          disabled={currentAssets.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg font-medium text-sm"
        >
          <Save className="w-4 h-4" />
          Salva Portfolio
        </button>
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all shadow-md hover:shadow-lg font-medium text-sm"
        >
          <FolderOpen className="w-4 h-4" />
          Carica Portfolio
        </button>
      </div>

      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Salva Portfolio</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Portfolio
                </label>
                <input
                  type="text"
                  value={portfolioName}
                  onChange={(e) => setPortfolioName(e.target.value)}
                  placeholder="es. Portfolio Bilanciato"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSave}
                  disabled={!portfolioName.trim() || loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 font-medium shadow-md"
                >
                  {loading ? 'Salvataggio...' : 'Salva'}
                </button>
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">I Miei Portfolio</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : portfolios.length === 0 ? (
                <div className="text-center py-12">
                  <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">Nessun portfolio salvato</p>
                  <p className="text-sm text-gray-400">Salva il tuo primo portfolio per iniziare</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {portfolios.map((portfolio) => (
                    <div
                      key={portfolio.id}
                      className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl border border-gray-200 hover:shadow-md transition-all group"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{portfolio.name}</h4>
                        <p className="text-sm text-gray-500 mt-1">
                          {portfolio.currency} {portfolio.initial_capital.toLocaleString()} · {new Date(portfolio.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoad(portfolio.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium shadow-sm"
                        >
                          Carica
                        </button>
                        <button
                          onClick={() => handleDelete(portfolio.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
