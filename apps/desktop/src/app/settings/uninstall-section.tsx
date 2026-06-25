import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { AlertTriangle, Loader2, Trash2 } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { DesktopUninstallMode, DesktopUninstallSummary } from '@/global'

import { SectionHeading } from './primitives'

interface ModeOption {
  mode: DesktopUninstallMode
  title: string
  description: string
  /** Shown in the confirm step so people know exactly what disappears. */
  consequence: string
  /** True when the option removes the Python agent (hidden if no agent). */
  needsAgent: boolean
}

const OPTIONS: ModeOption[] = [
  {
    mode: 'gui',
    title: '채팅 GUI만 제거',
    description: '이 데스크탑 앱만 제거합니다. Hermes 에이전트, 설정, 채팅은 그대로 유지됩니다.',
    consequence: '데스크탑 채팅 GUI(이 앱과 해당 데이터)',
    needsAgent: false
  },
  {
    mode: 'lite',
    title: 'GUI와 에이전트 제거, 내 데이터는 유지',
    description: '앱과 Hermes 에이전트는 제거하지만, 나중에 다시 설치할 수 있도록 설정, 채팅, 비밀 값은 유지합니다.',
    consequence: '채팅 GUI와 Hermes 에이전트(설정, 채팅, 비밀 값은 유지됨)',
    needsAgent: true
  },
  {
    mode: 'full',
    title: '모두 제거',
    description: '앱, 에이전트, 모든 사용자 데이터(설정, 채팅, 예약 작업, 비밀 값, 로그)를 제거합니다.',
    consequence: '모든 항목 — 채팅 GUI, Hermes 에이전트, 모든 설정, 채팅, 비밀 값, 로그',
    // full removes the agent (and user data), so it's an agent-removing option:
    // hide it on a lite client with no local agent, same as lite. A lite client
    // connecting to a remote backend has no local agent OR local user data the
    // GUI installed, so gui-only is the correct (and only) option there.
    needsAgent: true
  }
]

export function UninstallSection() {
  const [summary, setSummary] = useState<DesktopUninstallSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<DesktopUninstallMode | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    const bridge = window.hermesDesktop?.uninstall
    if (!bridge) {
      setLoading(false)
      return
    }
    void bridge
      .summary()
      .then(result => {
        if (alive) {
          setSummary(result)
        }
      })
      .catch(() => {
        // Non-fatal — we degrade to offering the GUI-only option.
      })
      .finally(() => {
        if (alive) {
          setLoading(false)
        }
      })
    return () => {
      alive = false
    }
  }, [])

  const bridge = window.hermesDesktop?.uninstall
  if (!bridge) {
    return null
  }

  // Gate the agent-removing options on whether an agent is actually present.
  // A future lite client that ships without the bundled agent shows GUI-only.
  const agentInstalled = summary?.agent_installed ?? false
  const visibleOptions = OPTIONS.filter(opt => agentInstalled || !opt.needsAgent)

  const handleConfirm = async () => {
    if (!pending) {
      return
    }
    setRunning(true)
    setError(null)
    try {
      const result = await bridge.run(pending)
      if (!result.ok) {
        setError(result.message || result.error || '제거를 시작할 수 없습니다.')
        setRunning(false)
        setPending(null)
      }
      // On success the app quits shortly; keep the spinner up until it does.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setRunning(false)
      setPending(null)
    }
  }

  const pendingOption = OPTIONS.find(opt => opt.mode === pending) ?? null

  return (
    <div className="mx-auto mt-8 w-full max-w-2xl">
      <SectionHeading icon={AlertTriangle} title="위험 구역" />

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            설치된 항목 확인 중…
          </div>
        ) : pendingOption ? (
          <div>
            <p className="text-sm font-medium text-destructive">제거 확인</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {pendingOption.consequence}을(를) 제거합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            {summary?.running_app_path && (
              <p className="mt-1 font-mono text-[0.68rem] text-muted-foreground/60">
                앱: {summary.running_app_path}
              </p>
            )}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                disabled={running}
                onClick={() => void handleConfirm()}
                size="sm"
                variant="destructive"
              >
                {running && <Loader2 className="size-3 animate-spin" />}
                {running ? '제거 중…' : '예, 제거합니다'}
              </Button>
              <Button disabled={running} onClick={() => setPending(null)} size="sm" variant="text">
                취소
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Hermes 제거</p>
            <p className="text-xs text-muted-foreground">
              제거할 범위를 선택하세요. 작업을 완료하기 위해 앱이 닫힙니다. 언제든 설치 관리자를 다시 열어 돌아올 수 있습니다.
            </p>
            <div className="mt-1 flex flex-col gap-2">
              {visibleOptions.map(opt => (
                <button
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 text-left transition',
                    'hover:border-destructive/40 hover:bg-destructive/5'
                  )}
                  key={opt.mode}
                  onClick={() => {
                    setError(null)
                    setPending(opt.mode)
                  }}
                  type="button"
                >
                  <Trash2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{opt.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
