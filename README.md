# Portfolio Analyzer

A modern portfolio backtesting and analysis webapp with real-time asset search, historical performance tracking, and comprehensive risk metrics.

## Features

- **Asset Search**: Search assets by ticker, ISIN, or company name with autocomplete suggestions
- **Portfolio Builder**: Create custom portfolios with weight allocation
- **Performance Charts**: Visualize portfolio value over time (linear or logarithmic scale)
- **Risk Metrics**:
  - Annual Return
  - Volatility
  - Sharpe Ratio
  - Value at Risk (VaR) at 95%
  - Conditional VaR (CVaR)
- **Returns Distribution**: Histogram of rolling annual returns
- **Multi-Currency**: Support for EUR, USD, GBP with automatic conversion
- **Clean Design**: Minimal, production-ready UI inspired by curvo.eu

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure API keys for Supabase Edge Functions (optional, for real market data):

The app uses Supabase Edge Functions as a proxy to avoid CORS issues. To enable real market data, configure these secrets in your Supabase dashboard:

- `ALPHA_VANTAGE_KEY` - Get free key at: https://www.alphavantage.co/support/#api-key
- `EODHD_API_KEY` - Get free key at: https://eodhistoricaldata.com/register

To set secrets in Supabase:
```bash
# Using Supabase CLI (if available)
supabase secrets set ALPHA_VANTAGE_KEY=your_key
supabase secrets set EODHD_API_KEY=your_key
```

Or use the Supabase Dashboard: Project Settings → Edge Functions → Secrets

**Note**: Without API keys, Edge Functions will use demo keys (limited) and the app will fallback to synthetic data.

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

## How It Works

### Asset Search
- Enter ticker (e.g., "AAPL"), ISIN (e.g., "US0378331005"), or company name
- Select from autocomplete suggestions
- Each asset includes its native currency

### Portfolio Creation
- Add assets with percentage weights
- Weights should total 100% for balanced portfolio
- Adjust weights anytime with inline editing

### Data Sources
1. **With API keys**: Fetches real market data via Supabase Edge Functions (no CORS issues)
2. **Without API keys**: Uses demo keys or fallback to synthetic data (GBM with realistic parameters)

### Calculations
- **NAV Series**: Computed from historical prices with currency conversion
- **Returns**: Calculated from daily price changes
- **Volatility**: Annualized standard deviation of returns
- **Sharpe Ratio**: Risk-adjusted return (assuming 2% risk-free rate)
- **VaR/CVaR**: Based on rolling 1-year returns at 95% confidence

## Technology Stack

- **React + TypeScript**
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Charts
- **Supabase** - Database (ready for portfolio persistence)
- **Lucide React** - Icons

## Future Enhancements

- Save/load portfolios from Supabase
- Compare multiple portfolios
- More asset classes (bonds, crypto, commodities)
- Advanced risk metrics (max drawdown, Sortino ratio)
- Rebalancing simulations
- Export to CSV/PDF
