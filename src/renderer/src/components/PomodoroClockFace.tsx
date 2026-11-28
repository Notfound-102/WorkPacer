import React from 'react'
import { useTranslation } from 'react-i18next'
import { PomodoroClockStyle, PomodoroState } from '@shared/types'
import { formatClockTimer } from '../lib/formatters'

interface PomodoroClockFaceProps {
  pomodoro: PomodoroState
  clockStyle: PomodoroClockStyle
  compact?: boolean
}

export const PomodoroClockFace: React.FC<PomodoroClockFaceProps> = ({
  pomodoro,
  clockStyle,
  compact = false
}) => {
  const { t } = useTranslation()
  const isBreak = pomodoro.phase === 'break'
  const accentColor = isBreak ? 'var(--accent)' : 'var(--coral)'
  const totalSec = Math.max(
    60,
    (isBreak ? pomodoro.breakMinutes : pomodoro.focusMinutes) * 60
  )
  const remainingFraction = Math.max(0, Math.min(1, pomodoro.remainingSec / totalSec))
  const elapsedPct = Math.max(0, Math.min(100, (1 - remainingFraction) * 100))

  const phaseLabel = isBreak ? t('status.pomodoro_break') : t('status.pomodoro_focus')

  // 1. Digital Clock Style
  if (clockStyle === 'digital') {
    return (
      <div className="flex flex-col items-center justify-center py-3 px-2 space-y-2.5 w-full">
        <span
          className={`px-3 py-0.5 rounded-full text-[11px] font-semibold ${
            isBreak
              ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'bg-[var(--coral-soft)] text-[var(--coral)]'
          }`}
        >
          {phaseLabel}
        </span>
        <div
          className={`font-mono font-extrabold tracking-tight tabular-nums leading-none ${
            compact ? 'text-4xl' : 'text-5xl'
          }`}
        >
          {formatClockTimer(pomodoro.remainingSec)}
        </div>
        <div className="w-full max-w-[200px] h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
          <div
            style={{ width: `${100 - elapsedPct}%`, backgroundColor: accentColor }}
            className="h-full rounded-full transition-all duration-500"
          />
        </div>
      </div>
    )
  }

  // 2. Analog Watch / Chronometer Style
  if (clockStyle === 'analog') {
    const remainingMinutes = pomodoro.remainingSec / 60
    // Minute hand maps 0..60 min onto 0..360 deg clockwise from 12 o'clock
    const minAngleDeg = ((remainingMinutes % 60) / 60) * 360
    // Second hand maps 0..60 sec onto 0..360 deg
    const secAngleDeg = ((pomodoro.remainingSec % 60) / 60) * 360

    const minRad = ((minAngleDeg - 90) * Math.PI) / 180
    const secRad = ((secAngleDeg - 90) * Math.PI) / 180

    const minX = 64 + Math.cos(minRad) * 36
    const minY = 64 + Math.sin(minRad) * 36
    const secX = 64 + Math.cos(secRad) * 44
    const secY = 64 + Math.sin(secRad) * 44

    const ringRadius = 52
    const circumference = 2 * Math.PI * ringRadius
    const sectorFraction = Math.min(1, remainingMinutes / 60)

    const sizeClass = compact ? 'w-36 h-36' : 'w-40 h-40'

    return (
      <div className="flex flex-col items-center justify-center py-1">
        <div className={`relative ${sizeClass} flex items-center justify-center`}>
          <svg className="w-full h-full" viewBox="0 0 128 128">
            {/* Outer dial rim */}
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="var(--bg-subtle)"
              stroke="var(--border-strong)"
              strokeWidth="1.5"
            />

            {/* Remaining minutes arc along inner bezel */}
            <circle
              cx="64"
              cy="64"
              r={ringRadius}
              fill="none"
              stroke={accentColor}
              strokeOpacity="0.24"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - sectorFraction)}
              transform="rotate(-90 64 64)"
              strokeLinecap="round"
            />

            {/* 60 Minute & 12 Five-Minute Tick Marks */}
            {Array.from({ length: 60 }, (_, i) => {
              const isMajor = i % 5 === 0
              const a = ((i * 6 - 90) * Math.PI) / 180
              const rOuter = 55
              const rInner = isMajor ? 48.5 : 52
              return (
                <line
                  key={i}
                  x1={64 + Math.cos(a) * rInner}
                  y1={64 + Math.sin(a) * rInner}
                  x2={64 + Math.cos(a) * rOuter}
                  y2={64 + Math.sin(a) * rOuter}
                  stroke={isMajor ? 'var(--text-primary)' : 'var(--text-muted)'}
                  strokeOpacity={isMajor ? 0.78 : 0.35}
                  strokeWidth={isMajor ? 1.8 : 0.9}
                  strokeLinecap="round"
                />
              )
            })}

            {/* Sub-dial digital readout at 6 o'clock */}
            <text
              x="64"
              y="90"
              textAnchor="middle"
              fill="var(--text-secondary)"
              fontSize="11"
              fontFamily="monospace"
              fontWeight="700"
            >
              {formatClockTimer(pomodoro.remainingSec)}
            </text>

            {/* Primary Minute / Countdown Hand */}
            <line
              x1="64"
              y1="64"
              x2={minX}
              y2={minY}
              stroke="var(--text-primary)"
              strokeWidth="3.6"
              strokeLinecap="round"
            />

            {/* Sweeping Second Hand */}
            <line
              x1={64 - Math.cos(secRad) * 9}
              y1={64 - Math.sin(secRad) * 9}
              x2={secX}
              y2={secY}
              stroke={accentColor}
              strokeWidth="1.8"
              strokeLinecap="round"
            />

            {/* Center Jewel Pivot */}
            <circle cx="64" cy="64" r="4.2" fill={accentColor} />
            <circle cx="64" cy="64" r="1.8" fill="#ffffff" />
          </svg>
        </div>
      </div>
    )
  }

  // 3. Circular Countdown Ring with Number in Center ('ring')
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - remainingFraction)
  const sizeClass = compact ? 'w-36 h-36' : 'w-40 h-40'

  return (
    <div className="flex flex-col items-center justify-center py-1">
      <div className={`relative ${sizeClass} flex items-center justify-center`}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--bg-subtle)"
            strokeWidth="7.5"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth="7.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute text-center px-2">
          <div className="font-mono text-2xl font-bold tabular-nums leading-tight">
            {formatClockTimer(pomodoro.remainingSec)}
          </div>
          <div className="text-[11px] font-medium text-[var(--text-secondary)] mt-0.5 truncate max-w-[96px]">
            {phaseLabel}
          </div>
        </div>
      </div>
    </div>
  )
}
