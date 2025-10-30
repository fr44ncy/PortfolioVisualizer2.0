// src/components/MetricsCard.tsx
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'positive' | 'negative' | 'neutral';
}

export default function MetricsCard({ title, value, subtitle, trend }: MetricsCardProps) {
  let bgGradient = 'from-gray-50 to-gray-100';
  let textColor = 'text-gray-700';
  let borderColor = 'border-gray-200';
  let icon = <Minus className="w-5 h-5" />;
  
  if (trend === 'positive') {
    bgGradient = 'from-green-50 to-emerald-100';
    textColor = 'text-green-600';
    borderColor = 'border-green-200';
    icon = <TrendingUp className="w-5 h-5" />;
  }
  if (trend === 'negative') {
    bgGradient = 'from-red-50 to-rose-100';
    textColor = 'text-red-600';
    borderColor = 'border-red-200';
    icon = <TrendingDown className="w-5 h-5" />;
  }

  return (
    <div className={`bg-gradient-to-br ${bgGradient} p-5 rounded-2xl border-2 ${borderColor} shadow-lg transform hover:scale-105 transition-all duration-200`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-600 uppercase tracking-wide">{title}</div>
        <div className={textColor}>{icon}</div>
      </div>
      <div className={`text-3xl font-black ${textColor} leading-tight`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1 font-medium">{subtitle}</div>}
    </div>
  );
}