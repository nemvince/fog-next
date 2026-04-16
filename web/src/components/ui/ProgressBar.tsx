import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number      // 0–100
  className?: string
  showLabel?: boolean
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

const colorMap = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

export function ProgressBar({ value, className, showLabel, color = 'blue' }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-700">
        <div
          className={cn('h-full rounded-full transition-all duration-300', colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="w-10 text-right text-xs text-gray-400">{pct}%</span>}
    </div>
  )
}
