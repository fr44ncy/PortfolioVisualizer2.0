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
// Stile compattato
const YearRow = ({ year, ret }: { year: string, ret: number }) => (
  <li className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-b-0">
    <span className="font-semibold text-gray-800">{year}</span>
    <span className={`font-bold ${ret >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    worstYears = sortedData.slice(-3).reverse(); // Prende gli ultimi 3 e li inverte
  }

  return (
    // Card con padding ridotto (p-5) e altezza piena per riempire la griglia
    <div className="bg-white p-5 rounded-2xl border-2 border-gray-200 shadow-lg h-full">
      
      {!hasEnoughData ? (
         // Altezza minima per allinearsi alle 6 card (circa 2 righe di card)
         <div className="flex items-center justify-center h-full min-h-[260px]">
           <p className="text-sm text-center text-gray-400">
             Dati insufficienti per l'analisi.
           </p>
         </div>
      ) : (
        // Layout a colonna singola (verticale)
        <div>
          
          {/* Sezione Anni Migliori */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-green-500 flex-shrink-0" />
              <h4 className="text-base font-bold text-gray-900">Anni Migliori</h4>
            </div>
            <ul className="space-y-0.5">
              {bestYears.map((d) => (
                <YearRow key={`best-${d.year}`} year={d.year} ret={d.return} />
              ))}
            </ul>
          </div>
          
          {/* Divisore */}
          <hr className="my-3 border-gray-200" />

          {/* Sezione Anni Peggiori */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertOctagon className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h4 className="text-base font-bold text-gray-900">Anni Peggiori</h4>
            </div>
            <ul className="space-y-0.5">
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