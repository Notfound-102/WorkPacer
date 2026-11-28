import React, { useEffect, useState } from 'react'
import { useIdlePulse } from './hooks/useIdlePulse'
import { MainWindow } from './windows/MainWindow'
import { StickyWidget } from './windows/StickyWidget'
import { PomodoroWidget } from './windows/PomodoroWidget'
import { ReturnPopup } from './windows/ReturnPopup'
import { BreakOverlay } from './windows/BreakOverlay'

type WindowRoute = 'main' | 'widget' | 'pomodoro-widget' | 'return-popup' | 'break-overlay'

function parseWindowRoute(): WindowRoute {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (hash.startsWith('pomodoro-widget')) return 'pomodoro-widget'
  if (hash.startsWith('widget')) return 'widget'
  if (hash.startsWith('return-popup')) return 'return-popup'
  if (hash.startsWith('break-overlay')) return 'break-overlay'
  return 'main'
}

export const App: React.FC = () => {
  const [route, setRoute] = useState<WindowRoute>(parseWindowRoute)
  const {
    state,
    settings,
    quickIdlePresets,
    timelineVersion,
    updateStatus,
    setUpdateStatus,
    activeTab,
    setActiveTab
  } = useIdlePulse()

  useEffect(() => {
    const onHash = (): void => setRoute(parseWindowRoute())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    const isFrameless = route !== 'main'
    document.documentElement.classList.toggle('frameless-transparent', isFrameless)
    document.body.classList.toggle('frameless-transparent', isFrameless)
  }, [route])

  if (!state) {
    return (
      <div
        className={`h-screen w-screen flex items-center justify-center text-xs text-[var(--text-muted)] ${
          route === 'main' ? 'ambient-mesh-bg' : 'bg-transparent'
        }`}
      >
        {route === 'main' ? 'Loading WorkPacer...' : ''}
      </div>
    )
  }

  if (route === 'widget') {
    return <StickyWidget state={state} settings={settings} presets={quickIdlePresets} />
  }

  if (route === 'pomodoro-widget') {
    return <PomodoroWidget state={state} settings={settings} />
  }

  if (route === 'return-popup') {
    const popup = state.pendingReturnPopup ?? {
      sessionId: 0,
      durationSec: 300,
      startTime: Date.now() - 300_000,
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
      presets={quickIdlePresets}
      timelineVersion={timelineVersion}
      updateStatus={updateStatus}
      onUpdateStatusChange={setUpdateStatus}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
    />
  )
}
