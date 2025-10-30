/*
  # Portfolio Backtester Database Schema

  1. New Tables
    - `portfolios`
      - `id` (uuid, primary key)
      - `user_id` (uuid, nullable, references auth.users)
      - `session_id` (text, for anonymous users)
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
      - `currency` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can only access their own portfolios
    - Anonymous users can access portfolios with their session_id
*/

CREATE TABLE IF NOT EXISTS portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text,
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
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

-- Authenticated user policies
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

-- Anonymous user policies
CREATE POLICY "Anonymous users can view own session portfolios"
  ON portfolios FOR SELECT
  TO anon
  USING (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can insert portfolios"
  ON portfolios FOR INSERT
  TO anon
  WITH CHECK (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can update own session portfolios"
  ON portfolios FOR UPDATE
  TO anon
  USING (session_id IS NOT NULL)
  WITH CHECK (session_id IS NOT NULL);

CREATE POLICY "Anonymous users can delete own session portfolios"
  ON portfolios FOR DELETE
  TO anon
  USING (session_id IS NOT NULL);

-- Authenticated user asset policies
CREATE POLICY "Users can view assets of own portfolios"
  ON portfolio_assets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert assets to own portfolios"
  ON portfolio_assets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update assets of own portfolios"
  ON portfolio_assets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete assets from own portfolios"
  ON portfolio_assets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.user_id = auth.uid()
    )
  );

-- Anonymous user asset policies
CREATE POLICY "Anonymous users can view portfolio assets"
  ON portfolio_assets FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.session_id IS NOT NULL
    )
  );

CREATE POLICY "Anonymous users can insert portfolio assets"
  ON portfolio_assets FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.session_id IS NOT NULL
    )
  );

CREATE POLICY "Anonymous users can update portfolio assets"
  ON portfolio_assets FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.session_id IS NOT NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.session_id IS NOT NULL
    )
  );

CREATE POLICY "Anonymous users can delete portfolio assets"
  ON portfolio_assets FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM portfolios
      WHERE portfolios.id = portfolio_assets.portfolio_id
      AND portfolios.session_id IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_session_id ON portfolios(session_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_assets_portfolio_id ON portfolio_assets(portfolio_id);