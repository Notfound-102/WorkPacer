import React from 'react'
import {
  BookOpen,
  Coffee,
  Dumbbell,
  Footprints,
  Moon,
  Phone,
  Sparkles,
  Users,
  Utensils
} from 'lucide-react'
import { QuickPresetIcon } from '@shared/types'

interface WorkPacerLogoProps {
  size?: number
  className?: string
}

export const WorkPacerLogo: React.FC<WorkPacerLogoProps> = ({ size = 32, className = '' }) => {
  const uid = React.useId().replace(/:/g, '')
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="WorkPacer Logo"
    >
      <defs>
        <linearGradient id={`wpBg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="50%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id={`wpRim-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.16" />
        </linearGradient>
        <linearGradient id={`wpArc-${uid}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#99F6E4" />
          <stop offset="100%" stopColor="#FFFFFF" />
        </linearGradient>
      </defs>
      <rect x="24" y="24" width="464" height="464" rx="112" fill={`url(#wpBg-${uid})`} />
      <rect
        x="30"
        y="30"
        width="452"
        height="452"
        rx="106"
        fill="none"
        stroke={`url(#wpRim-${uid})`}
        strokeWidth="10"
      />
      <circle
        cx="256"
        cy="256"
        r="138"
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity="0.26"
        strokeWidth="32"
      />
      <path
        d="M 150.3 167.3 A 138 138 0 1 1 220.3 389.3"
        fill="none"
        stroke={`url(#wpArc-${uid})`}
        strokeWidth="32"
        strokeLinecap="round"
      />
      <line
        x1="256"
        y1="256"
        x2="206"
        y2="225"
        stroke="#BAFAF0"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <line
        x1="256"
        y1="256"
        x2="326"
        y2="201"
        stroke="#FFFFFF"
        strokeWidth="34"
        strokeLinecap="round"
      />
      <circle cx="256" cy="256" r="28" fill="#FFFFFF" />
      <circle cx="364.7" cy="171.0" r="30" fill="#FBBF24" />
    </svg>
  )
}

export const QUICK_PRESET_ICONS: QuickPresetIcon[] = [
  'utensils',
  'users',
  'coffee',
  'footprints',
  'moon',
  'phone',
  'book',
  'dumbbell',
  'sparkles'
]

export const PresetIconView: React.FC<{ icon: QuickPresetIcon; className?: string }> = ({
  icon,
  className = 'w-3.5 h-3.5'
}) => {
  switch (icon) {
    case 'utensils':
      return <Utensils className={className} />
    case 'users':
      return <Users className={className} />
    case 'coffee':
      return <Coffee className={className} />
    case 'footprints':
      return <Footprints className={className} />
    case 'moon':
      return <Moon className={className} />
    case 'phone':
      return <Phone className={className} />
    case 'book':
      return <BookOpen className={className} />
    case 'dumbbell':
      return <Dumbbell className={className} />
    default:
      return <Sparkles className={className} />
  }
}
