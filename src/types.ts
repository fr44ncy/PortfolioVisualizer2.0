// src/types.ts
export interface Asset {
  id: string;
  ticker: string;
  isin?: string;
  weight: number;
  currency: string;
}

export interface Portfolio {
  id?: string;
  user_id?: string;
  name: string;
  currency: string;
  initial_capital: number;
  portfolio_assets?: PortfolioAsset[];
  created_at?: string;
  updated_at?: string;
}

export interface PortfolioAsset {
  id?: string;
  portfolio_id?: string;
  ticker: string;
  isin?: string;
  weight: number;
  currency: string;
  created_at?: string;
}

export interface PricePoint {
  date: string;
  close: number;
  currency: string;
}

export interface NavPoint {
  date: string;
  nav: number;
}

export interface PortfolioMetrics {
  annualReturn: number | null;
  annualVol: number | null;
  sharpe: number | null;
  var95: number | null;
  cvar95: number | null;
  finalValue: number | null;
}

export interface AssetSuggestion {
  ticker: string;
  isin?: string;
  name: string;
  currency: string; 
}