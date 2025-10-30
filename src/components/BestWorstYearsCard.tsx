// src/components/BestWorstYearsCard.tsx
import React from 'react';
import { Award, AlertOctagon } from 'lucide-react';

interface YearReturn {
  year: string;
  return: number;
}

interface BestWorstYearsCardProps {
  data: YearReturn[];
}

// Componente helper per una singola riga (Anno + Ritorno)
const YearRow = ({ year, ret }: { year: string, ret: number }) => (
  <li className="flex justify-between items-center text-sm py-2 border-b border-gray-100 last:border-b-0">
    <span className="font-semibold text-gray-800">{year}</span>
    <span className={`font-bold text-lg ${ret >= 0 ? 'text-green-600' : 'text-red-600'}`}>
      {ret >= 0 ? '+' : ''}
      {(ret * 100).toFixed(1)}%
    </span>
  </li>
);

export default function BestWorstYearsCard({ data }: BestWorstYearsCardProps) {
  
  const hasEnoughData = data && data.length > 0;
  
  let bestYears: YearReturn[] = [];
  let worstYears: YearReturn[] = [];

  if (hasEnoughData) {
    const sortedData = [...data].sort((a, b) => b.return - a.return);
    bestYears = sortedData.slice(0, 3);
    worstYears = sortedData.slice(-3).reverse(); // Prende gli ultimi 3 e li inverte (il peggiore prima)
  }

  return (
    <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-lg h-full">
      
      {!hasEnoughData ? (
         <div className="flex items-center justify-center h-full min-h-[150px]">
           <p className="text-sm text-center text-gray-400">
             Dati insufficienti per calcolare gli anni migliori/peggiori.
           </p>
         </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          
          {/* Colonna Anni Migliori */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-6 h-6 text-green-500 flex-shrink-0" />
              <h4 className="text-base font-bold text-gray-900">3 Anni Migliori</h4>
            </div>
            <ul className="space-y-1">
              {bestYears.map((d) => (
                <YearRow key={`best-${d.year}`} year={d.year} ret={d.return} />
              ))}
            </ul>
          </div>
          
          {/* Colonna Anni Peggiori */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertOctagon className="w-6 h-6 text-red-500 flex-shrink-0" />
              <h4 className="text-base font-bold text-gray-900">3 Anni Peggiori</h4>
            </div>
            <ul className="space-y-1">
              {worstYears.map((d) => (
                <YearRow key={`worst-${d.year}`} year={d.year} ret={d.return} />
              ))}
            </ul>
          </div>

        </div>
      )}
    </div>
  );
}