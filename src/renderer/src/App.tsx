import React, { useEffect, useState } from 'react'
import { useIdlePulse } from './hooks/useIdlePulse'
import { MainWindow } from './windows/MainWindow'
import { StickyWidget } from './windows/StickyWidget'
import { ReturnPopup } from './windows/ReturnPopup'
import { BreakOverlay } from './windows/BreakOverlay'

type WindowRoute = 'main' | 'widget' | 'return-popup' | 'break-overlay'

function parseWindowRoute(): WindowRoute {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash.startsWith('widget')) return 'widget'
  if (hash.startsWith('return-popup')) return 'return-popup'
  if (hash.startsWith('break-overlay')) return 'break-overlay'
  return 'main'
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<WindowRoute>(parseWindowRoute)
  const { state, settings, activeTab, setActiveTab } = useIdlePulse()

  useEffect(() => {
    const onHash = (): void => setRoute(parseWindowRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    if (route !== 'main') {
      document.body.classList.add('frameless-transparent')
    } else {
      document.body.classList.remove('frameless-transparent')
    }
  }, [route])

  if (!state) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-app)] text-xs text-[var(--text-muted)]">
        Loading IdlePulse...
      </div>
    )
  }

  if (route === 'widget') {
    return <StickyWidget state={state} settings={settings} />
  }

  if (route === 'return-popup') {
    const popup = state.pendingReturnPopup ?? {
      sessionId: 0,
      durationSec: 600,
      startTime: Date.now() - 600_000,
      endTime: Date.now()
    }
    return <ReturnPopup popup={popup} />
  }

  if (route === 'break-overlay') {
    const overlay = state.activeBreakOverlay ?? {
      kind: 'eye_20_20_20',
      countdownSec: 20
    }
    return <BreakOverlay overlay={overlay} settings={settings} />
  }

  return (
    <MainWindow
      state={state}
      settings={settings}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    />
  )
}
