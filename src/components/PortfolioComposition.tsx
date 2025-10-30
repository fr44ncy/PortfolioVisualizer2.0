import React, { useState } from 'react';
import { Trash2, PieChart } from 'lucide-react';
import { Asset } from '../types';
import AssetSearch from './AssetSearch';

interface PortfolioCompositionProps {
  assets: Asset[];
  onAddAsset: (ticker: string, isin: string | undefined, currency: string) => void;
  onRemoveAsset: (id: string) => void;
  onUpdateWeight: (id: string, weight: number) => void;
}

export default function PortfolioComposition({
  assets,
  onAddAsset,
  onRemoveAsset,
  onUpdateWeight
}: PortfolioCompositionProps) {
  const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
  const isBalanced = Math.abs(totalWeight - 100) < 0.01;

  const handleSelect = (ticker: string, isin: string | undefined, currency: string) => {
    onAddAsset(ticker, isin, currency);
  };

  // Genera colori per il grafico a torta
  const colors = [
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-red-500',
    'bg-indigo-500',
  ];

  return (
    <div className="bg-gradient-to-br from-white to-purple-50 rounded-3xl border-2 border-purple-200 shadow-2xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
          <PieChart className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-black text-gray-900 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Composizione Portfolio
        </h2>
      </div>

      <div className="space-y-3 mb-6">
        <AssetSearch onSelect={handleSelect} />
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {assets.length === 0 ? (
          <div className="text-center py-12 bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border-2 border-dashed border-purple-200">
            <PieChart className="w-12 h-12 text-purple-300 mx-auto mb-3" />
            <p className="text-sm text-purple-600 font-bold">Nessun asset</p>
            <p className="text-xs text-purple-500 mt-1">Cerca e aggiungi asset per iniziare</p>
          </div>
        ) : (
          <>
            {assets.map((asset, idx) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-white to-purple-50 rounded-xl group hover:shadow-lg transition-all border-2 border-purple-100 hover:border-purple-300"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]} shadow-lg`}></div>
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-900">{asset.ticker}</div>
                    <div className="text-xs text-purple-600 font-medium">
                      {asset.isin ? `${asset.isin} · ` : ''}{asset.currency}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={asset.weight}
                    onChange={(e) => onUpdateWeight(asset.id, Number(e.target.value))}
                    className="w-20 px-3 py-2 text-sm text-right font-bold border-2 border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="text-sm text-purple-600 font-bold">%</span>

                  <button
                    onClick={() => onRemoveAsset(asset.id)}
                    className="opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Totale con indicatore visivo */}
            <div className={`flex items-center justify-between pt-4 border-t-2 mt-4 ${
              isBalanced ? 'border-green-200' : 'border-orange-200'
            }`}>
              <span className="text-sm font-bold text-gray-700">Totale Allocazione</span>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className={`text-lg font-black ${
                    isBalanced ? 'text-green-600' : 'text-orange-600'
                  }`}>
                    {totalWeight.toFixed(1)}%
                  </div>
                  {!isBalanced && (
                    <div className="absolute -bottom-4 right-0 text-xs text-orange-600 font-medium whitespace-nowrap">
                    </div>
                  )}
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isBalanced ? 'bg-green-100' : 'bg-orange-100'
                }`}>
                  <span className="text-xl">{isBalanced ? '✓' : '!'}</span>
                </div>
              </div>
            </div>

            {/* Barra di progresso visiva */}
            <div className="mt-4">
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden border-2 border-gray-200">
                <div
                  className={`h-full transition-all duration-500 ${
                    totalWeight > 100 
                      ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                      : totalWeight < 100
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-400'
                      : 'bg-gradient-to-r from-green-400 to-emerald-500'
                  }`}
                  style={{ width: `${Math.min(totalWeight, 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1 font-medium">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}