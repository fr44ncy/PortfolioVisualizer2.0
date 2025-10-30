import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { NavPoint } from '../types';
import { formatCurrency } from '../lib/portfolioCalculations';

interface PortfolioChartProps {
  data: NavPoint[];
  currency: string;
  scale?: 'linear' | 'log';
}

export default function PortfolioChart({ data, currency, scale = 'linear' }: PortfolioChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-400 text-sm">
        Add assets to see portfolio performance
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-lg">
          <p className="text-xs text-gray-500 mb-1">{payload[0].payload.date}</p>
          <p className="text-sm font-medium">
            {formatCurrency(payload[0].value, currency)}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: '#999' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#999' }}
            tickFormatter={(v) => formatCurrency(v, currency)}
            scale={scale}
            domain={scale === 'log' ? ['auto', 'auto'] : undefined}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="nav"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            animationDuration={300}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
