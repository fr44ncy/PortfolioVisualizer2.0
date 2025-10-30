import React, { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { searchAssets } from '../lib/assetData';
import { AssetSuggestion } from '../types';

interface AssetSearchProps {
  onSelect: (ticker: string, isin: string | undefined, currency: string) => void;
}

// Hook per il debounce
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function AssetSearch({ onSelect }: AssetSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false); // Stato di caricamento

  const debouncedQuery = useDebounce(query, 300); // Debounce di 300ms

  useEffect(() => {
    if (debouncedQuery.length > 1) { // Cerca solo se la query è > 1
      setLoading(true);
      setShowSuggestions(true); // Mostra il box (anche se vuoto o in caricamento)
      
      const fetchSuggestions = async () => {
        try {
          const results = await searchAssets(debouncedQuery);
          setSuggestions(results);
        } catch (error) {
          console.error("Errore ricerca asset:", error);
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      };
      
      fetchSuggestions();
      
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
    }
  }, [debouncedQuery]); // Reagisce alla query "debounced"

  const handleSelect = (suggestion: AssetSuggestion) => {
    onSelect(suggestion.ticker, suggestion.isin, suggestion.currency);
    setQuery('');
    setShowSuggestions(false);
    setSuggestions([]);
  };
  
  const handleBlur = () => {
    // Nascondi i suggerimenti quando l'utente clicca fuori
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);
  };

  return (
    <div className="relative">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setShowSuggestions(query.length > 1 && true)}
          onBlur={handleBlur}
          placeholder="Search by ticker, ISIN or name..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {showSuggestions && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {loading && suggestions.length === 0 && (
             <div className="px-4 py-3 text-sm text-gray-500 text-center">
               Searching...
             </div>
          )}
          
          {!loading && suggestions.length === 0 && debouncedQuery.length > 1 && (
             <div className="px-4 py-3 text-sm text-gray-500 text-center">
               No results found for "{debouncedQuery}"
             </div>
          )}

          {suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onMouseDown={() => handleSelect(suggestion)} // onMouseDown per conflitto con onBlur
              className="w-full px-4 py-3 text-left hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{suggestion.ticker}</div>
                  <div className="text-xs text-gray-500">{suggestion.name}</div>
                </div>
                <div className='text-right'>
                  {suggestion.isin && (
                    <div className="text-xs text-gray-400 font-mono">{suggestion.isin}</div>
                  )}
                  <div className="text-xs text-gray-500 font-medium">{suggestion.currency}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}