/*
  # Portfolio Backtester Database Schema

  1. New Tables
    - `portfolios`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `currency` (text, default EUR)
      - `initial_capital` (numeric, default 100000)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `portfolio_assets`
      - `id` (uuid, primary key)
      - `portfolio_id` (uuid, references portfolios)
      - `ticker` (text)
      - `isin` (text, nullable)
      - `weight` (numeric)
      - `currency` (text)  -- *** AGGIUNTO CAMPO MANCANTE ***
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own portfolios
*/

CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Portfolio',
  currency text NOT NULL DEFAULT 'EUR',
  initial_capital numeric NOT NULL DEFAULT 100000,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portfolio_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker text NOT NULL,
  isin text,
  weight numeric NOT NULL DEFAULT 0 CHECK (weight >= 0 AND weight <= 100),
  currency text NOT NULL DEFAULT 'USD', -- *** AGGIUNTO CAMPO MANCANTE ***
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolios"
  ON portfolios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own portfolios"
  ON portfolios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own portfolios"
  ON portfolios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own portfolios"
  ON portfolios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE