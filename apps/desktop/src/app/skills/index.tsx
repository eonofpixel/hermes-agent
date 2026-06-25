import type * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { PageLoader } from '@/components/page-loader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Codicon } from '@/components/ui/codicon'
import { Switch } from '@/components/ui/switch'
import { TextTab, TextTabMeta } from '@/components/ui/text-tab'
import { getSkills, getToolsets, toggleSkill, toggleToolset } from '@/hermes'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { notify, notifyError } from '@/store/notifications'
import type { SkillInfo, ToolsetInfo } from '@/types/hermes'

import { useRefreshHotkey } from '../hooks/use-refresh-hotkey'
import { useRouteEnumParam } from '../hooks/use-route-enum-param'
import { PAGE_INSET_X } from '../layout-constants'
import { PageSearchShell } from '../page-search-shell'
import { ComputerUsePanel } from '../settings/computer-use-panel'
import { asText, includesQuery, prettyName, toolNames, toolsetDisplayLabel } from '../settings/helpers'
import { ToolsetConfigPanel } from '../settings/toolset-config-panel'
import type { SetStatusbarItemGroup } from '../shell/statusbar-controls'

const SKILLS_MODES = ['skills', 'toolsets'] as const
type SkillsMode = (typeof SKILLS_MODES)[number]

const KO_SKILL_CATEGORY_LABELS: Record<string, string> = {
  apple: '애플',
  'autonomous-ai-agents': '자율 AI 에이전트',
  creative: '크리에이티브',
  'data-science': '데이터 과학',
  email: '이메일',
  general: '일반',
  github: 'GitHub',
  media: '미디어',
  mlops: 'MLOps',
  'mlops/evaluation': 'MLOps / 평가',
  'mlops/inference': 'MLOps / 추론',
  'mlops/models': 'MLOps / 모델',
  'note-taking': '노트 작성',
  productivity: '생산성',
  research: '리서치',
  'smart-home': '스마트 홈',
  'social-media': '소셜 미디어',
  'software-development': '소프트웨어 개발',
  yuanbao: '위안바오'
}

const KO_SKILL_DESCRIPTIONS: Record<string, string> = {
  'apple-notes': 'memo CLI로 Apple Notes를 생성, 검색, 편집합니다.',
  'apple-reminders': 'remindctl로 Apple Reminders를 추가, 조회, 완료 처리합니다.',
  findmy: 'macOS FindMy.app으로 Apple 기기와 AirTag를 추적합니다.',
  imessage: 'macOS imsg CLI로 iMessage/SMS를 보내고 받습니다.',
  'macos-computer-use': '사용자 커서나 키보드 포커스를 빼앗지 않고 macOS 데스크탑을 백그라운드에서 조작합니다 — 스크린샷, 마우스, 키보드, 스크롤, 드래그 등.',
  'claude-code': 'Claude Code CLI에 코딩 작업을 위임합니다(기능 구현, PR 등).',
  codex: 'OpenAI Codex CLI에 코딩 작업을 위임합니다(기능 구현, PR 등).',
  'hermes-agent': 'Hermes Agent를 설정, 확장하거나 기여합니다.',
  opencode: 'OpenCode CLI에 코딩 작업을 위임합니다(기능 구현, PR 리뷰 등).',
  'architecture-diagram': '어두운 테마의 SVG 아키텍처/클라우드/인프라 다이어그램을 HTML로 만듭니다.',
  'ascii-art': 'pyfiglet, cowsay, boxes, 이미지-ASCII 변환으로 ASCII 아트를 만듭니다.',
  'baoyu-infographic': '21개 레이아웃 x 21개 스타일로 인포그래픽과 시각화를 만듭니다.',
  'claude-design': '랜딩 페이지, 덱, 프로토타입 같은 일회성 HTML 디자인 산출물을 만듭니다.',
  humanizer: 'AI스러운 문체를 줄이고 더 자연스러운 실제 목소리로 텍스트를 다듬습니다.',
  'jupyter-live-kernel': '라이브 Jupyter 커널을 사용해 Python을 반복적으로 실행합니다.',
  dogfood: '웹 앱을 탐색 QA하여 버그, 증거, 리포트를 찾습니다.',
  himalaya: '터미널에서 Himalaya CLI로 IMAP/SMTP 이메일을 다룹니다.',
  'github-auth': 'GitHub 인증 설정: HTTPS 토큰, SSH 키, gh CLI 로그인.',
  'github-code-review': 'PR diff를 리뷰하고 gh 또는 REST로 인라인 코멘트를 남깁니다.',
  'github-issues': 'gh 또는 REST로 GitHub 이슈를 생성, 분류, 라벨링, 할당합니다.',
  'github-pr-workflow': '브랜치, 커밋, PR 생성, CI, 병합까지 GitHub PR 흐름을 처리합니다.',
  'github-repo-management': '저장소 clone/create/fork, remote, release를 관리합니다.',
  'gif-search': 'curl + jq로 Tenor에서 GIF를 검색하고 다운로드합니다.',
  'youtube-content': 'YouTube 자막을 요약, 스레드, 블로그 글로 변환합니다.',
  'huggingface-hub': 'HuggingFace hf CLI로 모델/데이터셋을 검색, 다운로드, 업로드합니다.',
  obsidian: 'Obsidian vault의 노트를 읽고, 검색하고, 생성하고, 편집합니다.',
  airtable: 'curl로 Airtable REST API를 사용해 레코드를 CRUD, 필터, upsert합니다.',
  'google-workspace': 'gws CLI 또는 Python으로 Gmail, Calendar, Drive, Docs, Sheets를 다룹니다.',
  maps: 'OpenStreetMap/OSRM으로 지오코딩, POI, 경로, 시간대를 조회합니다.',
  notion: 'Notion API와 ntn CLI로 페이지, 데이터베이스, 마크다운, Workers를 다룹니다.',
  powerpoint: '.pptx 덱, 슬라이드, 노트, 템플릿을 생성/읽기/편집합니다.',
  arxiv: '키워드, 저자, 카테고리, ID로 arXiv 논문을 검색합니다.',
  polymarket: 'Polymarket의 시장, 가격, 오더북, 기록을 조회합니다.',
  openhue: 'OpenHue CLI로 Philips Hue 조명, 장면, 방을 제어합니다.',
  xurl: 'xurl CLI로 X/Twitter 게시, 검색, DM, 미디어, v2 API를 사용합니다.',
  'node-inspect-debugger': 'Node.js를 --inspect와 Chrome DevTools Protocol CLI로 디버깅합니다.',
  plan: '계획 모드: 실행 가능한 마크다운 계획을 .hermes/plans에 작성합니다.',
  'python-debugpy': 'pdb REPL과 debugpy 원격 DAP로 Python을 디버깅합니다.',
  'requesting-code-review': '커밋 전 리뷰: 보안 스캔, 품질 게이트, 자동 수정.',
  'test-driven-development': 'TDD: RED-GREEN-REFACTOR를 강제하고 코드보다 테스트를 먼저 작성합니다.'
}

const KO_TOOLSET_LABELS: Record<string, string> = {
  browser: '브라우저 자동화',
  clarify: '확인 질문',
  code_execution: '코드 실행',
  computer_use: '컴퓨터 조작(macOS)',
  context_engine: '컨텍스트 엔진',
  cronjob: '예약 작업',
  messaging: '크로스 플랫폼 메시징',
  discord: 'Discord 읽기/참여',
  discord_admin: 'Discord 관리',
  file: '파일 작업',
  terminal: '터미널',
  web: '웹',
  search: '웹 검색',
  vision: '이미지 분석',
  image_gen: '이미지 생성',
  video: '비디오',
  tts: '텍스트 음성 변환',
  skills: '스킬',
  memory: '메모리',
  session_search: '세션 검색',
  delegation: '서브에이전트 위임',
  todo: '작업 목록',
  homeassistant: '스마트 홈',
  spotify: 'Spotify',
  feishu_doc: 'Feishu 문서',
  feishu_drive: 'Feishu Drive',
  yuanbao: '위안바오'
}

const KO_TOOLSET_DESCRIPTIONS: Record<string, string> = {
  browser: '이동, 클릭, 입력, 스크롤',
  clarify: '사용자에게 확인 질문을 합니다',
  code_execution: 'Python 코드 실행',
  computer_use: 'cua-driver를 통한 백그라운드 데스크탑 제어',
  context_engine: '활성 컨텍스트 엔진의 런타임 도구',
  cronjob: '스킬 첨부 옵션과 함께 예약 작업을 생성/조회/수정/일시정지/재개/실행합니다',
  messaging: '메시지 보내기',
  discord: '메시지 가져오기, 멤버 검색, 스레드 생성',
  discord_admin: 'Discord 서버 관리 및 모더레이션',
  file: '파일 읽기, 쓰기, 검색, 패치',
  terminal: '셸 명령 실행 및 프로세스 관리',
  web: '웹 검색과 페이지 추출',
  search: '웹 검색',
  vision: '이미지와 스크린샷 분석',
  image_gen: '프롬프트로 이미지 생성',
  video: '비디오 분석 및 생성',
  tts: '텍스트를 음성 오디오로 변환',
  skills: '스킬 조회, 로드, 관리',
  memory: '세션 간 지속 메모리',
  session_search: '과거 세션 검색',
  delegation: '격리된 서브에이전트에 작업 위임',
  todo: '현재 세션 작업 목록 관리',
  homeassistant: 'Home Assistant 스마트 홈 제어',
  spotify: 'Spotify 재생 및 플레이리스트 제어',
  feishu_doc: 'Feishu/Lark 문서 도구',
  feishu_drive: 'Feishu/Lark Drive 도구',
  yuanbao: '위안바오 그룹과 멤버 조회'
}

function categoryFor(skill: SkillInfo): string {
  return asText(skill.category) || 'general'
}

function localizedCategory(category: string, locale: string): string {
  return locale === 'ko' ? (KO_SKILL_CATEGORY_LABELS[category] ?? prettyName(category)) : prettyName(category)
}

function localizedSkillDescription(skill: SkillInfo, locale: string): string {
  return locale === 'ko' ? (KO_SKILL_DESCRIPTIONS[skill.name] ?? asText(skill.description)) : asText(skill.description)
}

function localizedToolsetLabel(toolset: ToolsetInfo, locale: string): string {
  return locale === 'ko' ? (KO_TOOLSET_LABELS[toolset.name] ?? toolsetDisplayLabel(toolset)) : toolsetDisplayLabel(toolset)
}

function localizedToolsetDescription(toolset: ToolsetInfo, locale: string): string {
  return locale === 'ko' ? (KO_TOOLSET_DESCRIPTIONS[toolset.name] ?? asText(toolset.description)) : asText(toolset.description)
}

function filteredSkills(skills: SkillInfo[], query: string, category: string | null, locale: string): SkillInfo[] {
  const q = query.trim().toLowerCase()

  return skills
    .filter(skill => {
      if (category && categoryFor(skill) !== category) {
        return false
      }

      if (!q) {
        return true
      }

      return (
        includesQuery(skill.name, q) ||
        includesQuery(skill.description, q) ||
        includesQuery(localizedSkillDescription(skill, locale), q) ||
        includesQuery(skill.category, q) ||
        includesQuery(localizedCategory(categoryFor(skill), locale), q)
      )
    })
    .sort((a, b) => asText(a.name).localeCompare(asText(b.name)))
}

function filteredToolsets(toolsets: ToolsetInfo[], query: string, locale: string): ToolsetInfo[] {
  const q = query.trim().toLowerCase()

  return toolsets
    .filter(toolset => {
      if (!q) {
        return true
      }

      const label = toolsetDisplayLabel(toolset)
      const localizedLabel = localizedToolsetLabel(toolset, locale)
      const localizedDescription = localizedToolsetDescription(toolset, locale)

      return (
        includesQuery(toolset.name, q) ||
        includesQuery(label, q) ||
        includesQuery(localizedLabel, q) ||
        includesQuery(toolset.label, q) ||
        includesQuery(toolset.description, q) ||
        includesQuery(localizedDescription, q) ||
        toolNames(toolset).some(name => includesQuery(name, q))
      )
    })
    .sort((a, b) => localizedToolsetLabel(a, locale).localeCompare(localizedToolsetLabel(b, locale)))
}

interface SkillsViewProps extends React.ComponentProps<'section'> {
  setStatusbarItemGroup?: SetStatusbarItemGroup
}

export function SkillsView({ setStatusbarItemGroup: _setStatusbarItemGroup, ...props }: SkillsViewProps) {
  const { locale, t } = useI18n()
  const [mode, setMode] = useRouteEnumParam('tab', SKILLS_MODES, 'skills')

  const [query, setQuery] = useState('')
  const [skills, setSkills] = useState<SkillInfo[] | null>(null)
  const [toolsets, setToolsets] = useState<ToolsetInfo[] | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [savingSkill, setSavingSkill] = useState<string | null>(null)
  const [savingToolset, setSavingToolset] = useState<string | null>(null)
  const [expandedToolset, setExpandedToolset] = useState<string | null>(null)

  const refreshCapabilities = useCallback(async () => {
    setRefreshing(true)

    try {
      const [nextSkills, nextToolsets] = await Promise.all([getSkills(), getToolsets()])
      setSkills(nextSkills)
      setToolsets(nextToolsets)
    } catch (err) {
      notifyError(err, t.skills.skillsLoadFailed)
    } finally {
      setRefreshing(false)
    }
  }, [t])

  const refreshToolsets = useCallback(() => {
    getToolsets()
      .then(setToolsets)
      .catch(err => notifyError(err, t.skills.toolsetsRefreshFailed))
  }, [t])

  useRefreshHotkey(refreshCapabilities)

  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const categories = useMemo(() => {
    if (!skills) {
      return []
    }

    const counts = new Map<string, number>()

    for (const skill of skills) {
      const key = categoryFor(skill)
      counts.set(key, (counts.get(key) || 0) + 1)
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => ({ key, count }))
  }, [skills])

  const visibleSkills = useMemo(
    () => (skills ? filteredSkills(skills, query, mode === 'skills' ? activeCategory : null, locale) : []),
    [activeCategory, locale, mode, query, skills]
  )

  const visibleToolsets = useMemo(
    () => (toolsets ? filteredToolsets(toolsets, query, locale) : []),
    [locale, query, toolsets]
  )

  const skillGroups = useMemo(() => {
    const groups = new Map<string, SkillInfo[]>()

    for (const skill of visibleSkills) {
      const key = categoryFor(skill)
      groups.set(key, [...(groups.get(key) || []), skill])
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [visibleSkills])

  const totalSkills = skills?.length || 0
  const enabledToolsets = toolsets?.filter(toolset => toolset.enabled).length || 0

  async function handleToggleSkill(skill: SkillInfo, enabled: boolean) {
    setSavingSkill(skill.name)

    try {
      await toggleSkill(skill.name, enabled)
      setSkills(current => current?.map(row => (row.name === skill.name ? { ...row, enabled } : row)) ?? current)
      notify({
        kind: 'success',
        title: enabled ? t.skills.skillEnabled : t.skills.skillDisabled,
        message: t.skills.appliesToNewSessions(skill.name)
      })
    } catch (err) {
      notifyError(err, t.skills.failedToUpdate(skill.name))
    } finally {
      setSavingSkill(null)
    }
  }

  async function handleToggleToolset(toolset: ToolsetInfo, enabled: boolean) {
    setSavingToolset(toolset.name)

    try {
      await toggleToolset(toolset.name, enabled)
      setToolsets(
        current =>
          current?.map(row => (row.name === toolset.name ? { ...row, enabled, available: enabled } : row)) ?? current
      )
      notify({
        kind: 'success',
        title: enabled ? t.skills.toolsetEnabled : t.skills.toolsetDisabled,
        message: t.skills.appliesToNewSessions(toolsetDisplayLabel(toolset))
      })
    } catch (err) {
      notifyError(err, t.skills.failedToUpdate(toolsetDisplayLabel(toolset)))
    } finally {
      setSavingToolset(null)
    }
  }

  return (
    <PageSearchShell
      {...props}
      filters={
        mode === 'skills' && categories.length > 0 ? (
          <>
            <TextTab active={activeCategory === null} onClick={() => setActiveCategory(null)}>
              {t.skills.all} <TextTabMeta>{totalSkills}</TextTabMeta>
            </TextTab>
            {categories.map(category => (
              <TextTab
                active={activeCategory === category.key}
                key={category.key}
                onClick={() => setActiveCategory(activeCategory === category.key ? null : category.key)}
              >
                {localizedCategory(category.key, locale)} <TextTabMeta>{category.count}</TextTabMeta>
              </TextTab>
            ))}
          </>
        ) : undefined
      }
      onSearchChange={setQuery}
      searchHidden={mode === 'skills' ? (skills?.length ?? 0) === 0 : (toolsets?.length ?? 0) === 0}
      searchPlaceholder={mode === 'skills' ? t.skills.searchSkills : t.skills.searchToolsets}
      searchTrailingAction={
        <Button
          aria-label={refreshing ? t.skills.refreshing : t.skills.refresh}
          className="text-(--ui-text-tertiary) hover:bg-transparent hover:text-foreground"
          disabled={refreshing}
          onClick={() => void refreshCapabilities()}
          size="icon-xs"
          title={refreshing ? t.skills.refreshing : t.skills.refresh}
          type="button"
          variant="ghost"
        >
          <Codicon name="refresh" size="0.875rem" spinning={refreshing} />
        </Button>
      }
      searchValue={query}
      tabs={
        <>
          <TextTab active={mode === 'skills'} onClick={() => setMode('skills')}>
            {t.skills.tabSkills}
          </TextTab>
          <TextTab active={mode === 'toolsets'} onClick={() => setMode('toolsets')}>
            {t.skills.tabToolsets}
          </TextTab>
        </>
      }
    >
      {!skills || !toolsets ? (
        <PageLoader label={t.skills.loading} />
      ) : mode === 'skills' ? (
        <div className={cn('h-full overflow-y-auto py-3', PAGE_INSET_X)}>
          {visibleSkills.length === 0 ? (
            <EmptyState description={t.skills.noSkillsDesc} title={t.skills.noSkillsTitle} />
          ) : (
            <div className="space-y-4">
              {skillGroups.map(([category, list]) => (
                <div className="space-y-1.5" key={category}>
                  {activeCategory === null && (
                    <div className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {localizedCategory(category, locale)}
                    </div>
                  )}
                  <div>
                    {list.map(skill => (
                      <div
                        className="grid gap-3 px-0 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        key={skill.name}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{skill.name}</div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {localizedSkillDescription(skill, locale) || t.skills.noDescription}
                          </p>
                        </div>
                        <Switch
                          checked={skill.enabled}
                          disabled={savingSkill === skill.name}
                          onCheckedChange={checked => void handleToggleSkill(skill, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={cn('h-full overflow-y-auto py-3', PAGE_INSET_X)}>
          {visibleToolsets.length === 0 ? (
            <EmptyState description={t.skills.noToolsetsDesc} title={t.skills.noToolsetsTitle} />
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {t.skills.toolsetsEnabled(enabledToolsets, toolsets.length)}
              </div>
              <div>
                {visibleToolsets.map(toolset => {
                  const tools = toolNames(toolset)
                  const label = localizedToolsetLabel(toolset, locale)
                  const expanded = expandedToolset === toolset.name

                  return (
                    <div className="px-0 py-2.5" key={toolset.name}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{label}</div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            aria-expanded={expanded}
                            aria-label={t.skills.configureToolset(label)}
                            className="cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() =>
                              setExpandedToolset(current => (current === toolset.name ? null : toolset.name))
                            }
                            type="button"
                          >
                            <StatusPill active={toolset.configured}>
                              {toolset.configured ? t.skills.configured : t.skills.needsKeys}
                            </StatusPill>
                          </button>
                          <Switch
                            aria-label={t.skills.toggleToolset(label)}
                            checked={toolset.enabled}
                            disabled={savingToolset === toolset.name}
                            onCheckedChange={checked => void handleToggleToolset(toolset, checked)}
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {localizedToolsetDescription(toolset, locale) || t.skills.noDescription}
                      </p>
                      {tools.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tools.map(name => (
                            <span
                              className="rounded-md bg-(--ui-bg-quinary) px-1.5 py-0.5 font-mono text-[0.65rem] text-(--ui-text-tertiary)"
                              key={name}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                      {expanded && toolset.name === 'computer_use' && (
                        <ComputerUsePanel onConfiguredChange={refreshToolsets} />
                      )}
                      {expanded && <ToolsetConfigPanel onConfiguredChange={refreshToolsets} toolset={toolset.name} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </PageSearchShell>
  )
}

function StatusPill({ active, children }: { active: boolean; children: string }) {
  return (
    <Badge
      className={
        active ? 'bg-(--ui-bg-tertiary) text-(--ui-text-secondary)' : 'bg-(--ui-bg-quinary) text-(--ui-text-tertiary)'
      }
    >
      {children}
    </Badge>
  )
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid min-h-52 place-items-center text-center">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{description}</div>
      </div>
    </div>
  )
}
