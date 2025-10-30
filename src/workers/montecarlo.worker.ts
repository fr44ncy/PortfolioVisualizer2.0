// src/workers/montecarlo.worker.ts

// --- Funzioni di calcolo per il Worker ---

/**
 * Genera un numero casuale da una distribuzione normale (metodo Box-Muller).
 */
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/**
 * Ordina un array e trova il valore a un dato percentile.
 */
function getPercentile(arr: number[], percentile: number): number {
  arr.sort((a, b) => a - b);
  const index = (percentile / 100) * (arr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (upper === lower) return arr[lower];
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}


// --- Logica Principale del Worker ---

self.onmessage = (e) => {
  const { metrics, initialCapital, simYears, numSimulations } = e.data;
  
  if (!metrics || initialCapital === undefined || !simYears || !numSimulations) {
    self.postMessage({ error: 'Parametri di simulazione mancanti.' });
    return;
  }

  const mu = metrics.annualReturn || 0;
  const sigma = metrics.annualVol || 0;
  const dt = 1; // Intervallo di 1 anno

  // Store per tutti i valori finali per ogni anno
  const allYearEndValues: number[][] = Array.from({ length: simYears }, () => []);

  for (let i = 0; i < numSimulations; i++) {
    let currentValue = initialCapital;
    
    for (let year = 0; year < simYears; year++) {
      const z = gaussianRandom();
      // Formula Geometric Brownian Motion (GBM) per 1 anno
      currentValue = currentValue * Math.exp(
        (mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z
      );
      
      // Salva il risultato per quest'anno
      // Assicura che non sia negativo (un limite del modello GBM con alta vol.)
      allYearEndValues[year].push(Math.max(0, currentValue)); 
    }
  }

  // Ora calcola i percentili per ogni anno
  const simulationData = [];

  for (let year = 0; year < simYears; year++) {
    const yearValues = allYearEndValues[year];
    
    simulationData.push({
      year: year + 1, // Anno 1, 2, 3...
      moltoMale: getPercentile(yearValues, 5),    // 5° percentile
      cattivo: getPercentile(yearValues, 25),   // 25° percentile
      media: getPercentile(yearValues, 50),     // 50° percentile (Mediana)
      buono: getPercentile(yearValues, 75),     // 75° percentile
      grande: getPercentile(yearValues, 95),    // 95° percentile
    });
  }

  // Invia i dati pronti per il grafico al thread principale
  self.postMessage({ success: true, data: simulationData });
};