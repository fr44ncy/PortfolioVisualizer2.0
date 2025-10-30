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
  // Crea una copia prima di ordinare per non mutare l'array originale
  const sortedArr = [...arr].sort((a, b) => a - b);
  const index = (percentile / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (upper === lower) return sortedArr[lower];

  // Interpolazione lineare
  const weight = index - lower;
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
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
      
      allYearEndValues[year].push(Math.max(0, currentValue)); 
    }
  }

  // Ora calcola i percentili e i DELTA per lo stacking
  const simulationData = [];

  for (let year = 0; year < simYears; year++) {
    const yearValues = allYearEndValues[year];
    
    const p5 = getPercentile(yearValues, 5);
    const p25 = getPercentile(yearValues, 25);
    const p50 = getPercentile(yearValues, 50); // Mediana
    const p75 = getPercentile(yearValues, 75);
    const p95 = getPercentile(yearValues, 95);

    // *** MODIFICA: Calcola i delta per lo stacking ***
    // Il grafico ad area impilato richiede i "pezzi" da impilare.
    // Il grafico (come da foto) è composto da 3 bande + 1 linea
    // 1. Banda 5%-25%
    // 2. Banda 25%-75%
    // 3. Banda 75%-95%
    // 4. Linea 50% (Mediana)
    // Per impilarli, calcoliamo i delta *a partire dal 5° percentile* (moltoMale)
    
    const base = p5;                 // Banda 1 (Base): 0 -> 5% (lo facciamo partire da p5)
    const delta_5_25 = p25 - p5;     // Banda 2 (Delta): 5% -> 25%
    const delta_25_75 = p75 - p25;   // Banda 3 (Delta): 25% -> 75%
    const delta_75_95 = p95 - p75;   // Banda 4 (Delta): 75% -> 95%

    simulationData.push({
      year: year + 1, // Anno 1, 2, 3...
      
      // Dati per lo stack (Area)
      base: base,
      banda_5_25: delta_5_25 > 0 ? delta_5_25 : 0,
      banda_25_75: delta_25_75 > 0 ? delta_25_75 : 0,
      banda_75_95: delta_75_95 > 0 ? delta_75_95 : 0,

      // Dati per la linea (Line) e il tooltip
      media: p50,
      
      // Dati grezzi per il tooltip del grafico a linee
      moltoMale: p5,
      cattivo: p25,
      buono: p75,
      grande: p95,
    });
  }

  // Invia i dati pronti per il grafico al thread principale
  self.postMessage({ success: true, data: simulationData });
};