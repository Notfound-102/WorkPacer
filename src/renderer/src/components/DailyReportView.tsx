import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowDownUp,
  Check,
  Copy,
  FileText,
  Plus,
  RefreshCw,
  Trash2
} from 'lucide-react'
import { AppSettings, DailyReportDocument, DailyReportRow } from '@shared/types'
import {
  formatDailyReportPlainText,
  minutesToReportTime,
  parseTimeToMinutes
} from '@shared/reportFormatter'
import { bridge } from '../lib/bridge'
import { getTodayDateString } from '../lib/formatters'

interface DailyReportViewProps {
  settings: AppSettings
}

export const DailyReportView: React.FC<DailyReportViewProps> = ({ settings }) => {
  const { t } = useTranslation()
  const [dateStr, setDateStr] = useState(getTodayDateString())
  const [doc, setDoc] = useState<DailyReportDocument | null>(null)
  const [copied, setCopied] = useState(false)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    void bridge.getDailyReport(dateStr, false).then(setDoc)
  }, [dateStr])

  const persistDoc = async (next: DailyReportDocument): Promise<void> => {
    setDoc(next)
    await bridge.saveDailyReport(next)
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1800)
  }

  const handleRegenerate = async (): Promise<void> => {
    const fresh = await bridge.getDailyReport(dateStr, true)
    setDoc(fresh)
  }

  const handleRowChange = (
    id: string,
    field: keyof Omit<DailyReportRow, 'id'>,
    value: string
  ): void => {
    if (!doc) return
    const nextRows = doc.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    void persistDoc({ ...doc, rows: nextRows })
  }

  const handleAddRow = (): void => {
    if (!doc) return
    const last = doc.rows[doc.rows.length - 1]
    const nextStart = last ? last.endTime : doc.shiftStart
    const startMin = parseTimeToMinutes(nextStart)
    const endMin = Math.min(parseTimeToMinutes(doc.shiftEnd), startMin + 40)
    const nextEnd = endMin > startMin ? minutesToReportTime(endMin) : doc.shiftEnd

    const newRow: DailyReportRow = {
      id: `manual-${Date.now()}`,
      startTime: nextStart,
      endTime: nextEnd,
      content: t('report.defaultWork')
    }
    void persistDoc({ ...doc, rows: [...doc.rows, newRow] })
  }

  const handleDeleteRow = (id: string): void => {
    if (!doc) return
    void persistDoc({ ...doc, rows: doc.rows.filter((r) => r.id !== id) })
  }

  const handleSortRows = (): void => {
    if (!doc) return
    const sorted = [...doc.rows].sort(
      (a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime)
    )
    void persistDoc({ ...doc, rows: sorted })
  }

  const handleShiftOverride = async (
    field: 'shiftStart' | 'shiftEnd',
    value: string
  ): Promise<void> => {
    if (!doc) return
    const updated = { ...doc, [field]: value }
    await persistDoc(updated)
  }

  const plainText = useMemo(() => {
    if (!doc) return ''
    return formatDailyReportPlainText(dateStr, settings.userName, doc.rows)
  }, [dateStr, settings.userName, doc])

  const handleCopyPlainText = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(plainText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = plainText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{t('report.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">{t('report.subtitle')}</p>
        </div>

        <button
          id="report-regenerate-btn"
          type="button"
          onClick={() => void handleRegenerate()}
          className="btn-subtle px-3.5 py-2 text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
          {t('report.regenerate')}
        </button>
      </div>

      {/* Config Strip */}
      <div className="card-surface p-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 font-medium text-[var(--text-secondary)]">
            <span>{t('report.reportDate')}:</span>
            <input
              id="report-date-input"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="input-control !py-1 !px-2 !text-xs"
            />
          </label>

          {doc && (
            <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <span className="font-medium">{t('report.shiftWindow')}:</span>
              <input
                type="time"
                value={doc.shiftStart.padStart(5, '0')}
                onChange={(e) => void handleShiftOverride('shiftStart', e.target.value)}
                className="input-control !py-1 !px-2 !text-xs font-mono"
              />
              <span>~</span>
              <input
                type="time"
                value={doc.shiftEnd.padStart(5, '0')}
                onChange={(e) => void handleShiftOverride('shiftEnd', e.target.value)}
                className="input-control !py-1 !px-2 !text-xs font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={settings.hideLunchInReport}
              onChange={async (e) => {
                await bridge.updateSettings({ hideLunchInReport: e.target.checked })
                const fresh = await bridge.getDailyReport(dateStr, true)
                setDoc(fresh)
              }}
              className="accent-[var(--accent)]"
            />
            <span>
              {t('report.hideLunch', {
                start: settings.lunchStart,
                end: settings.lunchEnd
              })}
            </span>
          </label>

          <label className="flex items-center gap-1.5">
            <span>
              {t('report.mergeMicro', { min: settings.mergeMicroBreaksMinutes })}
            </span>
            <input
              type="number"
              min={0}
              max={30}
              value={settings.mergeMicroBreaksMinutes}
              onChange={async (e) => {
                const val = Math.max(0, Math.min(30, Number(e.target.value)))
                await bridge.updateSettings({ mergeMicroBreaksMinutes: val })
                const fresh = await bridge.getDailyReport(dateStr, true)
                setDoc(fresh)
              }}
              className="input-control w-14 !py-1 !px-2 !text-xs font-mono"
            />
          </label>
        </div>
      </div>

      {/* Main Split Studio: Visual Editor (Left) + Plain-Text Nippo Output (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Visual Inline Editor */}
        <div className="lg:col-span-7 card-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-semibold">Timeline ({doc?.rows.length ?? 0})</h2>
              {savedFlash && (
                <span className="text-[11px] font-medium text-[var(--accent)] bg-[var(--accent-soft)] px-2 py-0.5 rounded-full">
                  {t('report.savedBadge')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSortRows}
                className="btn-subtle px-2.5 py-1 text-xs flex items-center gap-1"
              >
                <ArrowDownUp className="w-3.5 h-3.5" />
                {t('report.sortRows')}
              </button>
              <button
                id="report-add-row-btn"
                type="button"
                onClick={handleAddRow}
                className="btn-primary px-2.5 py-1 text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                {t('report.addRow')}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[76px_14px_76px_minmax(0,1fr)_32px] gap-1.5 px-1 text-[11px] font-semibold text-[var(--text-muted)]">
              <span>{t('report.colStart')}</span>
              <span />
              <span>{t('report.colEnd')}</span>
              <span>{t('report.colContent')}</span>
              <span />
            </div>

            {doc?.rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[76px_14px_76px_minmax(0,1fr)_32px] gap-1.5 items-center"
              >
                <input
                  type="text"
                  value={row.startTime}
                  onChange={(e) => handleRowChange(row.id, 'startTime', e.target.value)}
                  placeholder="8:30"
                  className="input-control !py-1.5 !px-2 !text-xs font-mono text-center tabular-nums"
                />
                <span className="text-center text-xs text-[var(--text-muted)] font-mono">~</span>
                <input
                  type="text"
                  value={row.endTime}
                  onChange={(e) => handleRowChange(row.id, 'endTime', e.target.value)}
                  placeholder="9:30"
                  className="input-control !py-1.5 !px-2 !text-xs font-mono text-center tabular-nums"
                />
                <input
                  type="text"
                  value={row.content}
                  onChange={(e) => handleRowChange(row.id, 'content', e.target.value)}
                  className="input-control !py-1.5 !px-2.5 !text-xs w-full"
                />
                <button
                  type="button"
                  onClick={() => handleDeleteRow(row.id)}
                  className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--coral)] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Plain-Text Tab (\t) Preview & Copy */}
        <div className="lg:col-span-5 card-surface p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">{t('report.previewTitle')}</h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                {t('report.previewHint')}
              </p>
            </div>
          </div>

          <pre
            id="daily-report-plaintext-preview"
            style={{ tabSize: 6 }}
            className="w-full min-h-[260px] p-3.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono text-xs leading-relaxed overflow-x-auto whitespace-pre select-all"
          >
            {plainText}
          </pre>

          <button
            id="copy-daily-report-btn"
            type="button"
            onClick={() => void handleCopyPlainText()}
            className="w-full btn-primary py-2.5 px-4 text-sm flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                {t('report.copiedBtn')}
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                {t('report.copyBtn')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
