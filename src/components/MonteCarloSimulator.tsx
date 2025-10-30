// src/components/MonteCarloSimulator.tsx
import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PortfolioMetrics } from '../types';
import { formatCurrency } from '../lib/portfolioCalculations';
import { Play, Loader2, Zap } from 'lucide-react';

interface MonteCarloSimulatorProps {
  metrics: PortfolioMetrics;
  initialCapital: number;
  currency: string;
}

type SimDataPoint = {
  year: number;
  moltoMale: number;
  cattivo: number;
  media: number;
  buono: number;
  grande: number;
};

// Tooltip personalizzato per il grafico
const CustomTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-lg text-sm">
        <p className="text-xs text-gray-500 mb-2">Anno: {label}</p>
        {payload.slice().reverse().map((entry: any) => ( // Inverte per mostrare "Grande" in alto
          <div key={entry.name} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatCurrency(entry.value, currency)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function MonteCarloSimulator({
  metrics,
  initialCapital,
  currency
}: MonteCarloSimulatorProps) {
  
  const [loading, setLoading] = useState(false);
  const [simulationData, setSimulationData] = useState<SimDataPoint[]>([]);
  const [numSimulations, setNumSimulations] = useState<number>(1000);
  const [simYears, setSimYears] = useState<number>(30); // Fisso a 30 anni come da foto
  
  const canRun = metrics.annualReturn !== null && metrics.annualVol !== null;

  const handleRunSimulation = () => {
    if (!canRun || loading) return;

    setLoading(true);
    setSimulationData([]);

    // Crea il worker
    const worker = new Worker(new URL('../workers/montecarlo.worker.ts', import.meta.url), {
      type: 'module',
    });

    // Invia i dati al worker
    worker.postMessage({
      metrics,
      initialCapital,
      simYears,
      numSimulations,
    });

    // Riceve i dati dal worker
    worker.onmessage = (e) => {
      const { success, data, error } = e.data;
      if (success) {
        setSimulationData(data);
      } else {
        console.error('Errore Monte Carlo:', error);
      }
      setLoading(false);
      worker.terminate(); // Termina il worker dopo l'uso
    };

    worker.onerror = (e) => {
      console.error('Errore Worker:', e.message);
      setLoading(false);
      worker.terminate();
    };
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulazione Monte Carlo</h2>
          <p className="text-sm text-gray-600 mt-1">
            Proietta l'evoluzione del capitale in {simYears} anni su {numSimulations} scenari.
          </p>
        </div>
        
        {/* Controlli Simulazione */}
        <div className="flex items-center gap-3 mt-4 sm:mt-0">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <label className="text-sm text-gray-700 font-medium">Scenari</label>
            <select
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              disabled={loading}
              className="px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={!canRun || loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {loading ? 'Calcolo...' : 'Avvia Simulazione'}
          </button>
        </div>
      </div>

      {/* Area Grafico */}
      <div className="h-96">
        {!canRun && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            Aggiungi asset e bilancia il portfolio per avviare la simulazione.
          </div>
        )}
        {loading && (
          <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
             <div className="text-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <div className="text-sm font-medium text-gray-700">
                  Esecuzione di {numSimulations.toLocaleString()} simulazioni...
                </div>
             </div>
          </div>
        )}
        {!loading && simulationData.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={simulationData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 11, fill: '#999' }}
                label={{ value: 'Durata prevista del periodo in anni', position: 'insideBottom', dy: 10, fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#999' }}
                tickFormatter={(v) => formatCurrency(v, currency)}
                scale="linear"
                domain={['auto', 'auto']}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Legend verticalAlign="top" align="right" />
              
              {/* Linee come da foto */}
              <Line dataKey="moltoMale" name="Molto male (5%)" stroke="#d9534f" strokeWidth={2} dot={false} />
              <Line dataKey="cattivo" name="Cattivo (25%)" stroke="#f0ad4e" strokeWidth={2} dot={false} />
              <Line dataKey="media" name="Media (50%)" stroke="#0275d8" strokeWidth={3} dot={false} />
              <Line dataKey="buono" name="Buono (75%)" stroke="#5cb85c" strokeWidth={2} dot={false} />
              <Line dataKey="grande" name="Grande (95%)" stroke="#34a853" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
        {!loading && canRun && simulationData.length === 0 && (
           <div className="flex items-center justify-center h-full text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
             <Zap className="w-5 h-5 mr-2" />
             Clicca "Avvia Simulazione" per vedere le proiezioni.
           </div>
        )}
      </div>
    </div>
  );
}