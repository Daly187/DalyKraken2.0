/**
 * Fear & Greed Index Gauge Component
 * Visual gauge showing market sentiment from 0 (Extreme Fear) to 100 (Extreme Greed)
 */

import { useMemo } from 'react';

interface FearGreedGaugeProps {
  value: number;
  label: string;
  change?: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function FearGreedGauge({ value, label, change, size = 'md' }: FearGreedGaugeProps) {
  // Get color based on value
  const color = useMemo(() => {
    if (value <= 25) return { main: '#ef4444', light: '#fecaca', name: 'red' }; // Extreme Fear
    if (value <= 40) return { main: '#f97316', light: '#fed7aa', name: 'orange' }; // Fear
    if (value <= 60) return { main: '#eab308', light: '#fef08a', name: 'yellow' }; // Neutral
    if (value <= 75) return { main: '#84cc16', light: '#d9f99d', name: 'lime' }; // Greed
    return { main: '#22c55e', light: '#bbf7d0', name: 'green' }; // Extreme Greed
  }, [value]);

  // Size configurations
  const sizes = {
    sm: { width: 120, height: 80, strokeWidth: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
    md: { width: 180, height: 110, strokeWidth: 12, fontSize: 'text-2xl', labelSize: 'text-sm' },
    lg: { width: 240, height: 140, strokeWidth: 16, fontSize: 'text-4xl', labelSize: 'text-base' },
  };

  const config = sizes[size];

  // SVG arc calculations
  const cx = config.width / 2;
  const cy = config.height - 10;
  const radius = config.height - config.strokeWidth - 10;
  const startAngle = 180;
  const endAngle = 0;

  // Calculate the arc path
  const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy - r * Math.sin(rad),
    };
  };

  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);

  // Progress angle based on value (0-100)
  const progressAngle = 180 - (value / 100) * 180;
  const progress = polarToCartesian(cx, cy, radius, progressAngle);

  // Arc paths
  const backgroundArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
  const valueArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${progress.x} ${progress.y}`;

  return (
    <div className="flex flex-col items-center">
      <svg
        width={config.width}
        height={config.height}
        className="overflow-visible"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`fearGreedGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="25%" stopColor="#f97316" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="75%" stopColor="#84cc16" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={backgroundArc}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          className="text-slate-200 dark:text-slate-700"
        />

        {/* Value arc with gradient */}
        <path
          d={valueArc}
          fill="none"
          stroke={`url(#fearGreedGradient-${size})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          filter="url(#glow)"
          className="transition-all duration-500"
        />

        {/* Needle */}
        <circle
          cx={progress.x}
          cy={progress.y}
          r={config.strokeWidth / 2 + 2}
          fill={color.main}
          className="transition-all duration-500"
          filter="url(#glow)"
        />
        <circle
          cx={progress.x}
          cy={progress.y}
          r={config.strokeWidth / 4}
          fill="white"
          className="transition-all duration-500"
        />
      </svg>

      {/* Value and label */}
      <div className="text-center -mt-2">
        <div className={`${config.fontSize} font-bold`} style={{ color: color.main }}>
          {value}
        </div>
        <div className={`${config.labelSize} font-medium text-slate-600 dark:text-slate-400`}>
          {label}
        </div>
        {change !== undefined && change !== 0 && (
          <div className={`${config.labelSize} flex items-center justify-center gap-1`}>
            <span className={change > 0 ? 'text-green-500' : 'text-red-500'}>
              {change > 0 ? '↑' : '↓'} {Math.abs(change)}
            </span>
            <span className="text-slate-400">vs yesterday</span>
          </div>
        )}
      </div>
    </div>
  );
}
