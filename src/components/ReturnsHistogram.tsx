// src/components/ReturnsHistogram.tsx

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

interface ReturnsHistogramProps {
  // *** MODIFICA: Aggiornato il tipo di dato per i rendimenti annui ***
  data: { year: string; return: number }[];
}

export default function ReturnsHistogram({ data }: ReturnsHistogramProps) {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
        Dati insufficienti per i rendimenti annui
      </div>
    );
  }

  // *** MODIFICA: Tooltip personalizzato per mostrare Anno e Ritorno % ***
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { year, return: ret } = payload[0].payload;
      return (
        <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-xs text-gray-500 mb-1">Anno: {year}</p>
          <p className="text-sm font-medium">
            Ritorno: <span className={ret >= 0 ? 'text-green-600' : 'text-red-600'}>
              {(ret * 100).toFixed(2)}%
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
        >
          {/* Griglia solo orizzontale */}
          <CartesianGrid strokeDasharray="3 3" vertical={false} />

          {/* *** MODIFICA: Asse X mostra gli anni (categorico) *** */}
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: '#999' }}
          />
          
          {/* *** MODIFICA: Asse Y mostra il ritorno % *** */}
          <YAxis
            tick={{ fontSize: 11, fill: '#999' }}
            tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
            domain={['auto', 'auto']}
          />

          <Tooltip content={<CustomTooltip />} />
          
          {/* Linea di riferimento a 0% */}
          <ReferenceLine y={0} stroke="#666" strokeWidth={1} />

          {/* *** MODIFICA: Barre basate sul 'return' *** */}
          <Bar dataKey="return" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => {
              // Colora la barra in base al ritorno (positivo/negativo)
              const color = entry.return < 0 ? '#ef4444' : '#10b981';
              return <Cell key={`cell-${index}`} fill={color} opacity={0.8} />;
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}