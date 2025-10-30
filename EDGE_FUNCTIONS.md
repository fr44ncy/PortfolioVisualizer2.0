# Edge Functions Documentation

This app uses Supabase Edge Functions to proxy external API calls and avoid CORS issues.

## Deployed Functions

### 1. search-assets
**Endpoint**: `{SUPABASE_URL}/functions/v1/search-assets`

**Purpose**: Search for financial assets by ticker, ISIN, or company name

**Query Parameters**:
- `query` (required): Search term (min 2 characters)

**Response**:
```json
[
  {
    "ticker": "AAPL",
    "isin": "US0378331005",
    "name": "Apple Inc.",
    "currency": "USD"
  }
]
```

**Environment Variables**:
- `EODHD_API_KEY`:  68fe793540ec48.53643271

### 2. fetch-prices
**Endpoint**: `{SUPABASE_URL}/functions/v1/fetch-prices`

**Purpose**: Fetch historical price data for a given ticker

**Query Parameters**:
- `ticker` (required): Asset ticker symbol
- `currency` (optional): Asset currency (default: USD)

**Response**:
```json
[
  {
    "date": "2024-01-01",
    "close": 192.53,
    "currency": "USD"
  }
]
```

**Environment Variables**:
- `ALPHA_VANTAGE_KEY`:  RP16DXFQD0CRY6SP

## Setting Up API Keys

### Option 1: Supabase Dashboard
1. Go to your Supabase project
2. Navigate to: Project Settings → Edge Functions → Secrets
3. Add the following secrets:
   - `ALPHA_VANTAGE_KEY`
   - `EODHD_API_KEY`

### Option 2: Supabase CLI
```bash
supabase secrets set ALPHA_VANTAGE_KEY=your_key_here
supabase secrets set EODHD_API_KEY=your_key_here
```

## Getting Free API Keys

### Alpha Vantage (Historical Prices)
- **Sign up**: https://www.alphavantage.co/support/#api-key
- **Free tier**: 25 requests per day
- **Use case**: Historical daily price data

### EODHD (Asset Search)
- **Sign up**: https://eodhistoricaldata.com/register
- **Free tier**: 20 requests per day
- **Use case**: Search assets by ticker/ISIN/name

## Fallback Behavior

If API keys are not configured or API limits are reached:
1. **search-assets**: Returns empty array (search won't work)
2. **fetch-prices**: App falls back to synthetic data generation using Geometric Brownian Motion

## Testing Edge Functions

You can test the Edge Functions directly:

```bash
# Test search
curl "https://your-project.supabase.co/functions/v1/search-assets?query=apple"

# Test prices
curl "https://your-project.supabase.co/functions/v1/fetch-prices?ticker=AAPL&currency=USD"
```

## CORS Configuration

Both Edge Functions are configured with permissive CORS headers:
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
```

This allows the frontend to call these functions without CORS errors.
