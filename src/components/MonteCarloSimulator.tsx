// src/components/MonteCarloSimulator.tsx
import React, { useState } from 'react';
import { 
  LineChart, Line, 
  AreaChart, Area, 
  XAxis, YAxis, 
  CartesianGrid, Tooltip, 
  ResponsiveContainer, Legend 
} from 'recharts';
import { PortfolioMetrics } from '../types';
import { formatCurrency } from '../lib/portfolioCalculations';
import { Play, Loader2, Zap, LineChart as LineChartIcon, AreaChart as AreaChartIcon } from 'lucide-react';

interface MonteCarloSimulatorProps {
  metrics: PortfolioMetrics;
  initialCapital: number;
  currency: string;
}

// Dati inviati dal worker
type SimDataPoint = {
  year: number;
  // Dati per Line chart
  moltoMale: number;
  cattivo: number;
  media: number;
  buono: number;
  grande: number;
  // Dati per Area chart (stack)
  base: number;
  banda_5_25: number;
  banda_25_75: number;
  banda_75_95: number;
};

// Tooltip per GRAFICO A LINEE
const LineTooltip = ({ active, payload, label, currency }: any) => {
  if (active && payload && payload.length) {
    // Filtra solo le linee visibili (non le aree)
    const lines = payload.filter((p:any) => p.dataKey === 'moltoMale' || p.dataKey === 'cattivo' || p.dataKey === 'media' || p.dataKey === 'buono' || p.dataKey === 'grande');
    return (
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-lg text-sm">
        <p className="text-xs text-gray-500 mb-2">Anno: {label}</p>
        {lines.slice().reverse().map((entry: any) => (
          <div key={entry.name} style={{ color: entry.color }} className="font-medium">
            {entry.name}: {formatCurrency(entry.value, currency)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Tooltip per GRAFICO AD AREA (mostra la mediana e i range)
const AreaTooltip = ({ active, payload, label, currency, data }: any) => {
  if (active && label && data && data.length > 0) {
    // Troviamo il punto dati completo per quest'anno
    const dataPoint = data.find((d: SimDataPoint) => d.year === label);
    if (!dataPoint) return null;

    return (
      <div className="bg-white px-4 py-3 border border-gray-200 rounded-lg shadow-lg text-sm w-48">
        <p className="text-xs text-gray-500 mb-2">Anno: {label}</p>
        
        <div className="font-bold text-base text-blue-800 mb-2 pb-2 border-b">
          Mediana: {formatCurrency(dataPoint.media, currency)}
        </div>
        
        <div className="text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Range 25-75%:</span>
            <span className="font-medium">{formatCurrency(dataPoint.cattivo, currency)} - {formatCurrency(dataPoint.buono, currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Range 5-95%:</span>
            <span className="font-medium">{formatCurrency(dataPoint.moltoMale, currency)} - {formatCurrency(dataPoint.grande, currency)}</span>
          </div>
        </div>
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
  
  // *** MODIFICA: Stato per gli anni (ora dinamico) ***
  const [simYears, setSimYears] = useState<number>(30);
  
  const [chartType, setChartType] = useState<'lines' | 'area'>('lines');
  
  const canRun = metrics.annualReturn !== null && metrics.annualVol !== null;

  const handleRunSimulation = () => {
    if (!canRun || loading) return;

    setLoading(true);
    setSimulationData([]);

    // Crea il worker
    const worker = new Worker(new URL('../workers/montecarlo.worker.ts', import.meta.url), {
      type: 'module',
    });

    // Invia i dati (inclusi simYears e numSimulations dallo state) al worker
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Simulazione Monte Carlo</h2>
          {/* *** MODIFICA: Testo dinamico *** */}
          <p className="text-sm text-gray-600 mt-1">
            Proietta l'evoluzione del capitale in {simYears} anni su {numSimulations.toLocaleString()} scenari.
          </p>
        </div>
      </div>
      
      {/* Controlli Simulazione */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        
        {/* Gruppo Toggles Tipo Grafico */}
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg border border-gray-200">
            <label className="text-sm text-gray-700 font-medium pl-2 hidden sm:block">Grafico:</label>
            <button
              onClick={() => setChartType('lines')}
              disabled={loading}
              title="Grafico a Linee"
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                chartType === 'lines' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <LineChartIcon className="w-4 h-4" />
              Linee
            </button>
            <button
              onClick={() => setChartType('area')}
              disabled={loading}
              title="Grafico ad Area"
              className={`flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium ${
                chartType === 'area' 
                ? 'bg-white text-blue-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              <AreaChartIcon className="w-4 h-4" />
              Area
            </button>
        </div>

        {/* Gruppo Azioni */}
        <div className="flex flex-wrap items-center gap-3">
          {/* *** MODIFICA: Aggiunto Selettore Anni *** */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <label className="text-sm text-gray-700 font-medium">Anni</label>
            <select
              value={simYears}
              onChange={(e) => setSimYears(Number(e.target.value))}
              disabled={loading}
              className="w-full sm:w-auto px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={40}>40</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
            <label className="text-sm text-gray-700 font-medium">Scenari</label>
            <select
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              disabled={loading}
              className="w-full sm:w-auto px-2 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
              {/* *** MODIFICA: Aggiunto 50,000 *** */}
              <option value={50000}>50,000</option>
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={!canRun || loading}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {loading ? 'Calcolo...' : 'Avvia'}
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
          <>
            {/* --- GRAFICO 1: LINEE --- */}
            {chartType === 'lines' && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulationData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 11, fill: '#999' }}
                    label={{ value: 'Durata prevista del periodo in anni', position: 'insideBottom', dy: 15, fontSize: 12 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#999' }}
                    tickFormatter={(v) => formatCurrency(v, currency)}
                    scale="linear"
                    domain={['auto', 'auto']}
                  />
                  <Tooltip content={<LineTooltip currency={currency} />} />
                  <Legend verticalAlign="top" align="right" />
                  
                  <Line dataKey="moltoMale" name="Molto male (5%)" stroke="#d9534f" strokeWidth={2} dot={false} />
                  <Line dataKey="cattivo" name="Cattivo (25%)" stroke="#f0ad4e" strokeWidth={2} dot={false} />
                  <Line dataKey="media" name="Media (50%)" stroke="#0275d8" strokeWidth={3} dot={false} />
                  <Line dataKey="buono" name="Buono (75%)" stroke="#5cb85c" strokeWidth={2} dot={false} />
                  <Line dataKey="grande" name="Grande (95%)" stroke="#34a853" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
            
            {/* --- GRAFICO 2: AREE --- */}
            {chartType === 'area' && (
              <div className="relative w-full h-full"> 
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulationData} margin={{ top: 5, right: 20, left: 0, bottom: 20 }} stackOffset="none">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 11, fill: '#999' }}
                      label={{ value: 'Durata prevista del periodo in anni', position: 'insideBottom', dy: 15, fontSize: 12 }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#999' }}
                      tickFormatter={(v) => formatCurrency(v, currency)}
                      scale="linear"
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<AreaTooltip currency={currency} data={simulationData} />} />
                    
                    <Area 
                      type="monotone" 
                      dataKey="base" // 0 -> 5%
                      stackId="1" 
                      stroke="none" 
                      fill="#a0d8ff" 
                      fillOpacity={0.4}
                      name="Range 5-95%" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="banda_5_25" // 5% -> 25%
                      stackId="1" 
                      stroke="none" 
                      fill="#a0d8ff" 
                      fillOpacity={0.4}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="banda_25_75" // 25% -> 75%
                      stackId="1" 
                      stroke="none" 
                      fill="#40a9ff" 
                      fillOpacity={0.6}
                      name="Range 25-75%"
                    />
                     <Area 
                      type="monotone" 
                      dataKey="banda_75_95" // 75% -> 95%
                      stackId="1" 
                      stroke="none" 
                      fill="#a0d8ff" 
                      fillOpacity={0.4}
                    />

                    <Line 
                      type="monotone" 
                      dataKey="media" 
                      name="Portfolio - Mediana"
                      stroke="#0056b3" 
                      strokeWidth={2} 
                      dot={false}
                    />

                    <Legend verticalAlign="top" align="right" />
                    
                  </AreaChart>
                </ResponsiveContainer>
                {/* Etichetta numero simulazioni */}
                <div className="absolute top-2 right-8 bg-white bg-opacity-80 px-3 py-1 rounded-md border border-gray-200 shadow-sm text-xs font-semibold text-gray-700 pointer-events-none">
                  {numSimulations.toLocaleString()} simulazioni
                </div>
              </div>
            )}
          </>
        )}
        {!loading && canRun && simulationData.length === 0 && (
           <div className="flex items-center justify-center h-full text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
             <Zap className="w-5 h-5 mr-2" />
             Clicca "Avvia" per vedere le proiezioni.
           </div>
        )}
      </div>
    </div>
  );
}