import { useState } from 'react';

const configs = {
  'border-green-500': {
    grad: 'from-emerald-500 to-green-600',
    ring: 'ring-emerald-500/20 bg-emerald-500/10',
    border: 'border-emerald-500/15 dark:border-emerald-400/20',
    glow: 'shadow-emerald-500/5 hover:shadow-emerald-500/10',
    accent: '#10b981'
  },
  'border-blue-500': {
    grad: 'from-blue-500 to-indigo-600',
    ring: 'ring-blue-500/20 bg-blue-500/10',
    border: 'border-blue-500/15 dark:border-blue-400/20',
    glow: 'shadow-blue-500/5 hover:shadow-blue-500/10',
    accent: '#3b82f6'
  },
  'border-purple-500': {
    grad: 'from-purple-500 to-violet-600',
    ring: 'ring-purple-500/20 bg-purple-500/10',
    border: 'border-purple-500/15 dark:border-purple-400/20',
    glow: 'shadow-purple-500/5 hover:shadow-purple-500/10',
    accent: '#8b5cf6'
  },
  'border-indigo-500': {
    grad: 'from-indigo-500 to-blue-600',
    ring: 'ring-indigo-500/20 bg-indigo-500/10',
    border: 'border-indigo-500/15 dark:border-indigo-400/20',
    glow: 'shadow-indigo-500/5 hover:shadow-indigo-500/10',
    accent: '#6366f1'
  },
  'border-pink-500': {
    grad: 'from-rose-500 to-pink-600',
    ring: 'ring-rose-500/20 bg-rose-500/10',
    border: 'border-pink-500/15 dark:border-pink-400/20',
    glow: 'shadow-pink-500/5 hover:shadow-pink-500/10',
    accent: '#ec4899'
  },
  'border-cyan-500': {
    grad: 'from-cyan-500 to-blue-600',
    ring: 'ring-cyan-500/20 bg-cyan-500/10',
    border: 'border-cyan-500/15 dark:border-cyan-400/20',
    glow: 'shadow-cyan-500/5 hover:shadow-cyan-500/10',
    accent: '#06b6d4'
  },
  'border-amber-500': {
    grad: 'from-amber-500 to-orange-600',
    ring: 'ring-amber-500/20 bg-amber-500/10',
    border: 'border-amber-500/15 dark:border-amber-400/20',
    glow: 'shadow-amber-500/5 hover:shadow-amber-500/10',
    accent: '#f59e0b'
  },
  'border-emerald-500': {
    grad: 'from-emerald-500 to-teal-600',
    ring: 'ring-emerald-500/20 bg-emerald-500/10',
    border: 'border-emerald-500/15 dark:border-emerald-400/20',
    glow: 'shadow-emerald-500/5 hover:shadow-emerald-500/10',
    accent: '#10b981'
  },
  'border-emerald-400': {
    grad: 'from-teal-400 to-emerald-500',
    ring: 'ring-teal-400/20 bg-teal-400/10',
    border: 'border-teal-400/15 dark:border-teal-400/20',
    glow: 'shadow-teal-400/5 hover:shadow-teal-400/10',
    accent: '#10b981'
  },
  'border-teal-400': {
    grad: 'from-teal-400 to-cyan-500',
    ring: 'ring-teal-400/20 bg-teal-400/10',
    border: 'border-teal-400/15 dark:border-teal-400/20',
    glow: 'shadow-teal-400/5 hover:shadow-teal-400/10',
    accent: '#14b8a6'
  },
  'border-teal-500': {
    grad: 'from-teal-500 to-emerald-600',
    ring: 'ring-teal-500/20 bg-teal-500/10',
    border: 'border-teal-500/15 dark:border-teal-400/20',
    glow: 'shadow-teal-500/5 hover:shadow-teal-500/10',
    accent: '#14b8a6'
  },
  'border-red-500': {
    grad: 'from-red-500 to-rose-600',
    ring: 'ring-red-500/20 bg-red-500/10',
    border: 'border-red-500/15 dark:border-red-400/20',
    glow: 'shadow-red-500/5 hover:shadow-red-500/10',
    accent: '#ef4444'
  },
  'border-orange-400': {
    grad: 'from-orange-400 to-amber-500',
    ring: 'ring-orange-400/20 bg-orange-400/10',
    border: 'border-orange-400/15 dark:border-orange-400/20',
    glow: 'shadow-orange-400/5 hover:shadow-orange-400/10',
    accent: '#f97316'
  }
};

export default function StatCard({ label, value, icon, color = 'border-green-500', sub, progress, progressLabel, trend }) {
  const { grad, ring, border, glow, accent } = configs[color] || configs['border-green-500'];
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative rounded-2xl p-4 sm:p-4.5 shadow-md ${glow} transition-all duration-300 overflow-hidden group bg-white border ${border} hover:-translate-y-1`}
      style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {/* Real-time Cursor tracking neon light halo (Vercel style!) */}
      {isHovered && (
        <div 
          className="absolute pointer-events-none rounded-full transition-opacity duration-300 opacity-[0.06] dark:opacity-[0.09] blur-2xl"
          style={{
            width: '150px',
            height: '150px',
            background: `radial-gradient(circle, ${accent} 0%, transparent 70%)`,
            left: `${coords.x - 75}px`,
            top: `${coords.y - 75}px`,
            mixBlendMode: 'screen'
          }}
        />
      )}

      {/* Dynamic left glowing strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b ${grad} opacity-85`} />

      {/* Decorative radial pattern on hover */}
      <div className={`absolute -bottom-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${grad} opacity-0 group-hover:opacity-[0.04] blur-2xl transition-all duration-500 pointer-events-none`} />

      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] sm:text-[10px] font-extrabold tracking-widest text-gray-400 dark:text-slate-400 uppercase truncate mb-1">
            {label}
          </p>
          <div className="flex items-baseline gap-1.5">
            <h3 
              className="text-xl sm:text-2.5xl font-black text-gray-800 dark:text-white tracking-tight leading-none truncate font-display"
            >
              {value ?? '—'}
            </h3>
            
            {/* Glowing trend badge next to value */}
            {trend && (
              <span className="inline-flex items-center gap-0.5 text-[8px] font-black px-1.2 py-0.3 rounded bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 shadow-sm shrink-0 mb-0.5 select-none">
                <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                {trend}
              </span>
            )}
          </div>
        </div>

        {/* Floating icon badge */}
        <div 
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-md transition-transform duration-500 group-hover:scale-105 shrink-0 ring-3 ${ring}`}
        >
          {icon && <span className="scale-80 sm:scale-90 flex items-center justify-center">{icon}</span>}
        </div>
      </div>

      {/* Neon glowing progress bar if progress is defined */}
      {progress !== undefined && progress !== null && (
        <div className="mt-3 border-t border-gray-100 dark:border-white/5 pt-2">
          <div className="flex items-center justify-between text-[8px] font-black tracking-widest text-gray-400 dark:text-slate-400/80 mb-1 uppercase">
            <span>{progressLabel || 'SHARE OF TOTAL'}</span>
            <span className="font-extrabold text-[10px] tabular-nums" style={{ color: accent }}>{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-1 overflow-hidden">
            <div className={`bg-gradient-to-r ${grad} h-full rounded-full transition-all duration-500`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {sub && (progress === undefined || progress === null) && (
        <div className="mt-3 flex items-center gap-1.5 text-[9px] sm:text-[10px] font-semibold text-gray-400 dark:text-slate-400/70 border-t border-gray-100 dark:border-white/5 pt-2 truncate">
          <span className="truncate">{sub}</span>
        </div>
      )}
    </div>
  );
}
