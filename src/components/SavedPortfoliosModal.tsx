// src/components/SavedPortfoliosModal.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Asset, Portfolio } from '../types';
import { Loader2, X, Trash2 } from 'lucide-react';

interface SavedPortfoliosModalProps {
  show: boolean;
  onClose: () => void;
  onLoad: (
    assets: Asset[],
    config: { capital: number; currency: string; name: string }
  ) => void;
}

// Definiamo un tipo per il portfolio che include gli asset
type PortfolioWithAssets = Portfolio & { portfolio_assets: Asset[] };

export default function SavedPortfoliosModal({
  show,
  onClose,
  onLoad,
}: SavedPortfoliosModalProps) {
  const [portfolios, setPortfolios] = useState<PortfolioWithAssets[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (show) {
      fetchPortfolios();
    }
  }, [show]);

  const fetchPortfolios = async () => {
    setLoading(true);
    setError(null);
    try {
      // Usiamo RLS per prendere solo i portafogli dell'utente loggato
      const { data, error } = await supabase
        .from('portfolios')
        .select(`
          *,
          portfolio_assets (
            ticker,
            isin,
            weight,
            currency
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPortfolios(data as PortfolioWithAssets[]);
    } catch (error: any) {
      setError(error.message || 'Errore nel caricamento dei portafogli.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadClick = (p: PortfolioWithAssets) => {
    onLoad(p.portfolio_assets, {
      capital: p.initial_capital,
      currency: p.currency,
      name: p.name,
    });
  };

  const handleDeleteClick = async (id: string) => {
    if (window.confirm('Sei sicuro di voler eliminare questo portafoglio?')) {
      try {
        // Grazie a ON DELETE CASCADE, verranno eliminati anche gli asset
        const { error } = await supabase.from('portfolios').delete().eq('id', id);
        if (error) throw error;
        // Ricarica la lista
        setPortfolios(prev => prev.filter(p => p.id !== id));
      } catch (error: any) {
        alert(error.message || 'Impossibile eliminare il portafoglio.');
      }
    }
  };

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Portafogli Salvati
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          )}

          {error && (
            <div className="text-center py-10 text-red-600 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && portfolios.length === 0 && (
            <div className="text-center py-10 text-gray-500 text-sm">
              Nessun portafoglio salvato.
            </div>
          )}

          {!loading && !error && portfolios.length > 0 && (
            <div className="space-y-3">
              {portfolios.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg group"
                >
                  <div>
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.portfolio_assets.length} asset · Creato il{' '}
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDeleteClick(p.id!)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleLoadClick(p)}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                    >
                      Carica
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}