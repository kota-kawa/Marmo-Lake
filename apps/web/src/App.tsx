import {
  Archive,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  Circle,
  ClipboardList,
  ExternalLink,
  FileText,
  Home,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Wifi,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, ReactElement, ReactNode } from 'react'
import { apiFetch, deleteRequest, patchJson, postJson } from './api'
import type {
  AIActionProposal,
  AIProvider,
  Announcement,
  AppData,
  Checklist,
  ChecklistItem,
  FileItem,
  Note,
  WorkApp,
  Workspace,
} from './types'

type View = 'staff' | 'admin-login' | 'admin'
type StandardApp = 'home' | 'notes' | 'announcements' | 'checklists' | 'files' | 'ai'
type ActivePane = { type: 'standard'; key: StandardApp } | { type: 'work-app'; app: WorkApp }

const emptyData: AppData = {
  workspace: null,
  workApps: [],
  notes: [],
  announcements: [],
  checklists: [],
  files: [],
  providers: [],
}

const icons: Record<string, ReactElement> = {
  home: <Home />,
  briefcase: <Briefcase />,
  notes: <MessageSquare />,
  checklist: <ClipboardList />,
  files: <Archive />,
  ai: <Bot />,
  bell: <Bell />,
}

const standardApps = [
  { key: 'home', label: 'ホーム', icon: <LayoutDashboard />, tint: 'blue' },
  { key: 'notes', label: 'メモ', icon: <MessageSquare />, tint: 'yellow' },
  { key: 'announcements', label: 'お知らせ', icon: <Bell />, tint: 'red' },
  { key: 'checklists', label: 'チェック', icon: <ClipboardList />, tint: 'orange' },
  { key: 'files', label: '書類棚', icon: <Archive />, tint: 'teal' },
  { key: 'ai', label: 'AI', icon: <Bot />, tint: 'purple' },
] as const

function AppleLogo() {
  return (
    <svg viewBox="0 0 14 16" className="apple-logo" aria-hidden="true">
      <path
        fill="currentColor"
        d="M11.6 8.5c0-1.6 1.3-2.4 1.4-2.4-.8-1.1-2-1.3-2.4-1.3-1-.1-2 .6-2.5.6s-1.3-.6-2.2-.6c-1.1 0-2.2.7-2.8 1.7-1.2 2.1-.3 5.2.9 6.9.6.8 1.2 1.8 2.1 1.7.9 0 1.2-.6 2.2-.6s1.3.6 2.2.6c.9 0 1.5-.8 2.1-1.7.7-1 .9-2 .9-2-.1 0-1.8-.7-1.8-2.6zM9.9 3.4c.5-.6.8-1.4.7-2.2-.7 0-1.5.5-2 1-.4.5-.8 1.3-.7 2 .8.1 1.5-.4 2-.8z"
      />
    </svg>
  )
}

function MenuClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15000)
    return () => window.clearInterval(id)
  }, [])
  const date = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(now)
  const time = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  return (
    <span className="menubar-clock">
      {date} {time}
    </span>
  )
}

export function App() {
  const [isReady, setIsReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [view, setView] = useState<View>('staff')
  const [activePane, setActivePane] = useState<ActivePane>({ type: 'standard', key: 'home' })
  const [data, setData] = useState<AppData>(emptyData)
  const [toast, setToast] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3000)
  }

  const loadData = useCallback(async () => {
    const [workspace, workApps, notes, announcements, checklists, files, providers] =
      await Promise.all([
        apiFetch<Workspace>('/workspace'),
        apiFetch<WorkApp[]>('/work-apps'),
        apiFetch<Note[]>('/notes'),
        apiFetch<Announcement[]>('/announcements'),
        apiFetch<Checklist[]>('/checklists'),
        apiFetch<FileItem[]>('/files'),
        apiFetch<AIProvider[]>('/ai/providers'),
      ])
    setData({ workspace, workApps, notes, announcements, checklists, files, providers })
  }, [])

  const bootstrap = useCallback(async () => {
    try {
      const status = await apiFetch<{ is_setup_complete: boolean }>('/setup/status')
      setNeedsSetup(!status.is_setup_complete)
      if (status.is_setup_complete) {
        await loadData()
      }
      setIsReady(true)
    } catch (error) {
      setIsReady(true)
      showToast(error instanceof Error ? error.message : '起動に失敗しました')
    }
  }, [loadData])

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  const goStaff = (key: StandardApp = 'home') => {
    setView('staff')
    setActivePane({ type: 'standard', key })
  }

  const openTarget = (target: ActivePane) => {
    setView('staff')
    setActivePane(target)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (event.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!isReady) {
    return <Splash />
  }

  if (needsSetup) {
    return (
      <SetupWizard
        onComplete={async () => {
          setNeedsSetup(false)
          await loadData()
          setView('staff')
        }}
      />
    )
  }

  const activeKey: StandardApp | 'admin' | null =
    view === 'admin' || view === 'admin-login'
      ? 'admin'
      : activePane.type === 'standard'
        ? activePane.key
        : null

  return (
    <div className="desktop">
      <div className="wallpaper" aria-hidden="true" />
      <MenuBar
        workspace={data.workspace}
        view={view}
        sectionLabel={
          view === 'admin' || view === 'admin-login'
            ? '管理'
            : activePane.type === 'work-app'
              ? activePane.app.name
              : standardApps.find((a) => a.key === activeKey)?.label || 'ホーム'
        }
        onSearch={() => setPaletteOpen(true)}
        onRefresh={() => void loadData()}
      />

      <MobileBar
        workspace={data.workspace}
        sectionLabel={
          view === 'admin' || view === 'admin-login'
            ? '管理'
            : activePane.type === 'work-app'
              ? activePane.app.name
              : standardApps.find((a) => a.key === activeKey)?.label || 'ホーム'
        }
        onSearch={() => setPaletteOpen(true)}
        onAdmin={() => setView(view === 'admin' ? 'staff' : 'admin-login')}
        isAdmin={view === 'admin'}
      />

      <div className="stage">
        {view === 'staff' && (
          <StaffWorkspace
            data={data}
            activePane={activePane}
            setActivePane={setActivePane}
            reload={loadData}
            showToast={showToast}
            openAdmin={() => setView('admin-login')}
          />
        )}
        {view === 'admin-login' && (
          <AdminLogin
            onBack={() => setView('staff')}
            onLoggedIn={async () => {
              await loadData()
              setView('admin')
            }}
          />
        )}
        {view === 'admin' && (
          <AdminDashboard
            data={data}
            reload={loadData}
            showToast={showToast}
            onStaff={() => goStaff()}
            onLogout={async () => {
              await postJson('/session/logout', {})
              setView('staff')
            }}
          />
        )}
      </div>

      <Dock
        activeKey={activeKey}
        onApp={(key) => goStaff(key)}
        onAdmin={() => setView(view === 'admin' ? 'staff' : 'admin-login')}
        onRefresh={() => void loadData()}
      />

      {paletteOpen && (
        <CommandPalette
          data={data}
          onClose={() => setPaletteOpen(false)}
          onSelect={(target) => {
            openTarget(target)
            setPaletteOpen(false)
          }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function MenuBar({
  workspace,
  sectionLabel,
  onSearch,
  onRefresh,
}: {
  workspace: Workspace | null
  view: View
  sectionLabel: string
  onSearch: () => void
  onRefresh: () => void
}) {
  const menus = ['ファイル', '編集', '表示', '移動', 'ウインドウ', 'ヘルプ']
  return (
    <header className="menubar">
      <div className="menubar-left">
        <button className="menubar-item menubar-apple" aria-label="Apple">
          <AppleLogo />
        </button>
        <button className="menubar-item menubar-app">{workspace?.name || 'Marmo Lake'}</button>
        <span className="menubar-section">{sectionLabel}</span>
        {menus.map((m) => (
          <button key={m} className="menubar-item">
            {m}
          </button>
        ))}
      </div>
      <div className="menubar-right">
        <button className="menubar-status" onClick={onRefresh} aria-label="更新" title="更新">
          <RefreshCw />
        </button>
        <span className="menubar-status">
          <Wifi />
        </span>
        <span className="menubar-status battery" aria-hidden="true">
          <span className="battery-shell">
            <span className="battery-level" />
          </span>
        </span>
        <button className="menubar-status" onClick={onSearch} aria-label="検索" title="検索 (⌘K)">
          <Search />
        </button>
        <span className="menubar-status">
          <SlidersHorizontal />
        </span>
        <MenuClock />
      </div>
    </header>
  )
}

function MobileBar({
  workspace,
  sectionLabel,
  onSearch,
  onAdmin,
  isAdmin,
}: {
  workspace: Workspace | null
  sectionLabel: string
  onSearch: () => void
  onAdmin: () => void
  isAdmin: boolean
}) {
  return (
    <header className="mobile-bar">
      <div className="mobile-bar-titles">
        <span className="mobile-bar-workspace">{workspace?.name || 'Marmo Lake'}</span>
        <span className="mobile-bar-section">{sectionLabel}</span>
      </div>
      <div className="mobile-bar-actions">
        <button className="round-button" onClick={onSearch} aria-label="検索">
          <Search />
        </button>
        <button className="round-button" onClick={onAdmin} aria-label={isAdmin ? 'スタッフ画面' : '管理'}>
          {isAdmin ? <Home /> : <Lock />}
        </button>
      </div>
    </header>
  )
}

type SearchHit = {
  id: string
  title: string
  subtitle: string
  group: string
  tint: string
  icon: ReactElement
  target: ActivePane
}

function CommandPalette({
  data,
  onClose,
  onSelect,
}: {
  data: AppData
  onClose: () => void
  onSelect: (target: ActivePane) => void
}) {
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const hits = useMemo<SearchHit[]>(() => {
    const all: SearchHit[] = []
    standardApps.forEach((app) =>
      all.push({
        id: `app-${app.key}`,
        title: app.label,
        subtitle: '標準アプリ',
        group: 'アプリ',
        tint: app.tint,
        icon: app.icon,
        target: { type: 'standard', key: app.key },
      }),
    )
    data.workApps.forEach((app) =>
      all.push({
        id: `work-${app.id}`,
        title: app.name,
        subtitle: app.category || '業務画面',
        group: '業務画面',
        tint: 'graphite',
        icon: icons[app.icon] || <Briefcase />,
        target: { type: 'work-app', app },
      }),
    )
    data.notes.forEach((note) =>
      all.push({
        id: `note-${note.id}`,
        title: note.title,
        subtitle: note.body,
        group: 'メモ',
        tint: 'yellow',
        icon: <MessageSquare />,
        target: { type: 'standard', key: 'notes' },
      }),
    )
    data.announcements.forEach((item) =>
      all.push({
        id: `ann-${item.id}`,
        title: item.title,
        subtitle: item.body,
        group: 'お知らせ',
        tint: 'red',
        icon: <Bell />,
        target: { type: 'standard', key: 'announcements' },
      }),
    )
    data.checklists.forEach((item) =>
      all.push({
        id: `chk-${item.id}`,
        title: item.title,
        subtitle: `${item.items.length}項目`,
        group: 'チェック',
        tint: 'orange',
        icon: <ClipboardList />,
        target: { type: 'standard', key: 'checklists' },
      }),
    )
    data.files.forEach((file) =>
      all.push({
        id: `file-${file.id}`,
        title: file.name,
        subtitle: file.category || '書類',
        group: '書類棚',
        tint: 'teal',
        icon: <FileText />,
        target: { type: 'standard', key: 'files' },
      }),
    )

    const q = query.trim().toLowerCase()
    if (!q) return all.filter((hit) => hit.group === 'アプリ' || hit.group === '業務画面')
    return all.filter(
      (hit) => hit.title.toLowerCase().includes(q) || hit.subtitle.toLowerCase().includes(q),
    )
  }, [data, query])

  useEffect(() => {
    setCursor(0)
  }, [query])

  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((c) => Math.min(c + 1, hits.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((c) => Math.max(c - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = hits[cursor]
      if (hit) onSelect(hit.target)
    }
  }

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <Search />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="アプリ・メモ・お知らせ・チェック・書類を検索"
          />
          <kbd>esc</kbd>
        </div>
        <div className="palette-results">
          {hits.length === 0 && <div className="palette-empty">該当する項目がありません</div>}
          {hits.map((hit, index) => (
            <button
              key={hit.id}
              className={index === cursor ? 'palette-row active' : 'palette-row'}
              onMouseEnter={() => setCursor(index)}
              onClick={() => onSelect(hit.target)}
            >
              <span className={`sidebar-badge tint-${hit.tint}`}>{hit.icon}</span>
              <span className="palette-text">
                <span className="palette-title">{hit.title}</span>
                {hit.subtitle && <span className="palette-sub">{hit.subtitle}</span>}
              </span>
              <span className="palette-group">{hit.group}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Dock({
  activeKey,
  onApp,
  onAdmin,
  onRefresh,
}: {
  activeKey: StandardApp | 'admin' | null
  onApp: (key: StandardApp) => void
  onAdmin: () => void
  onRefresh: () => void
}) {
  return (
    <nav className="dock" aria-label="Dock">
      <div className="dock-tray">
        {standardApps.map((app) => (
          <button
            key={app.key}
            className="dock-item"
            data-label={app.label}
            onClick={() => onApp(app.key)}
            aria-label={app.label}
          >
            <span className={`dock-icon tint-${app.tint}`}>{app.icon}</span>
            <span className={activeKey === app.key ? 'dock-dot on' : 'dock-dot'} />
          </button>
        ))}
        <span className="dock-sep dock-extra" />
        <button className="dock-item dock-extra" data-label="更新" onClick={onRefresh} aria-label="更新">
          <span className="dock-icon tint-graphite">
            <RefreshCw />
          </span>
          <span className="dock-dot" />
        </button>
        <button className="dock-item dock-extra" data-label="管理" onClick={onAdmin} aria-label="管理">
          <span className="dock-icon tint-graphite">
            <Settings />
          </span>
          <span className={activeKey === 'admin' ? 'dock-dot on' : 'dock-dot'} />
        </button>
      </div>
    </nav>
  )
}

function MacWindow({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="mac-window">
      <aside className="window-sidebar">
        <div className="traffic-lights" aria-hidden="true">
          <span className="tl tl-close" />
          <span className="tl tl-min" />
          <span className="tl tl-max" />
        </div>
        <div className="sidebar-scroll">{sidebar}</div>
      </aside>
      <main className="window-main">{children}</main>
    </div>
  )
}

function Splash() {
  return (
    <div className="desktop center-screen">
      <div className="wallpaper" aria-hidden="true" />
      <section className="splash">
        <span className="splash-mark">
          <Sparkles />
        </span>
        <h1>Marmo Lake</h1>
        <div className="splash-bar">
          <span />
        </div>
      </section>
    </div>
  )
}

function SetupWizard({ onComplete }: { onComplete: () => void }) {
  const [form, setForm] = useState({
    admin_name: '管理者',
    admin_password: '',
    workspace_name: 'Marmo Lake',
    use_case: 'store',
    ai_provider: 'none',
    endpoint_url: '',
    model: '',
    api_key: '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await postJson('/setup', {
        admin_name: form.admin_name,
        admin_password: form.admin_password,
        workspace_name: form.workspace_name,
        use_case: form.use_case,
        ai_provider:
          form.ai_provider === 'none'
            ? null
            : {
                provider: form.ai_provider,
                display_name: form.ai_provider === 'ollama' ? 'Ollama' : 'OpenAI互換',
                endpoint_url: form.endpoint_url,
                model: form.model,
                api_key: form.api_key,
              },
      })
      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="desktop center-screen">
      <div className="wallpaper" aria-hidden="true" />
      <form className="sheet setup-card" onSubmit={submit}>
        <div className="setup-heading">
          <span className="setup-mark">
            <Sparkles />
          </span>
          <h1>Marmo Lake へようこそ</h1>
          <p>最初のワークスペースを作成します</p>
        </div>

        <div className="field-grid">
          <label>
            <span>ワークスペース</span>
            <input
              value={form.workspace_name}
              onChange={(event) => setForm({ ...form, workspace_name: event.target.value })}
              required
            />
          </label>
          <label>
            <span>利用シーン</span>
            <select
              value={form.use_case}
              onChange={(event) => setForm({ ...form, use_case: event.target.value })}
            >
              <option value="store">店舗</option>
              <option value="classroom">教室</option>
              <option value="office">小規模オフィス</option>
              <option value="community">地域団体</option>
              <option value="empty">空で開始</option>
            </select>
          </label>
          <label>
            <span>管理者名</span>
            <input
              value={form.admin_name}
              onChange={(event) => setForm({ ...form, admin_name: event.target.value })}
              required
            />
          </label>
          <label>
            <span>パスワード</span>
            <input
              type="password"
              minLength={8}
              value={form.admin_password}
              onChange={(event) => setForm({ ...form, admin_password: event.target.value })}
              required
            />
          </label>
        </div>

        <div className="inline-panel">
          <label>
            <span>AI 連携</span>
            <select
              value={form.ai_provider}
              onChange={(event) => setForm({ ...form, ai_provider: event.target.value })}
            >
              <option value="none">後で設定</option>
              <option value="openai_compatible">OpenAI互換</option>
              <option value="ollama">Ollama</option>
            </select>
          </label>
          {form.ai_provider !== 'none' && (
            <div className="field-grid compact">
              <label>
                <span>Endpoint</span>
                <input
                  placeholder={form.ai_provider === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com/v1'}
                  value={form.endpoint_url}
                  onChange={(event) => setForm({ ...form, endpoint_url: event.target.value })}
                />
              </label>
              <label>
                <span>Model</span>
                <input
                  placeholder={form.ai_provider === 'ollama' ? 'llama3.1' : 'gpt-4o-mini'}
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                />
              </label>
              {form.ai_provider === 'openai_compatible' && (
                <label className="wide">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={form.api_key}
                    onChange={(event) => setForm({ ...form, api_key: event.target.value })}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" disabled={saving}>
          {saving ? '作成中…' : '続ける'}
        </button>
      </form>
    </div>
  )
}

function StaffWorkspace({
  data,
  activePane,
  setActivePane,
  reload,
  showToast,
  openAdmin,
}: {
  data: AppData
  activePane: ActivePane
  setActivePane: (pane: ActivePane) => void
  reload: () => Promise<void>
  showToast: (message: string) => void
  openAdmin: () => void
}) {
  const sidebar = (
    <>
      <div className="sidebar-group-title">スタッフ</div>
      {standardApps.map((item) => (
        <button
          key={item.key}
          className={
            activePane.type === 'standard' && activePane.key === item.key
              ? 'sidebar-row active'
              : 'sidebar-row'
          }
          onClick={() => setActivePane({ type: 'standard', key: item.key })}
        >
          <span className={`sidebar-badge tint-${item.tint}`}>{item.icon}</span>
          <span className="sidebar-label">{item.label}</span>
        </button>
      ))}
      {data.workApps.length > 0 && (
        <>
          <div className="sidebar-group-title">業務</div>
          {data.workApps.map((app) => (
            <button
              key={app.id}
              className={
                activePane.type === 'work-app' && activePane.app.id === app.id
                  ? 'sidebar-row active'
                  : 'sidebar-row'
              }
              onClick={() => setActivePane({ type: 'work-app', app })}
            >
              <span className="sidebar-badge tint-graphite">{icons[app.icon] || <Briefcase />}</span>
              <span className="sidebar-label">{app.name}</span>
            </button>
          ))}
        </>
      )}
    </>
  )

  return (
    <MacWindow sidebar={sidebar}>
      {activePane.type === 'work-app' ? (
        <WorkAppViewer app={activePane.app} onClose={() => setActivePane({ type: 'standard', key: 'home' })} />
      ) : (
        <StandardPane
          pane={activePane.key}
          data={data}
          setActivePane={setActivePane}
          reload={reload}
          showToast={showToast}
          openAdmin={openAdmin}
        />
      )}
    </MacWindow>
  )
}

function StandardPane({
  pane,
  data,
  setActivePane,
  reload,
  showToast,
  openAdmin,
}: {
  pane: StandardApp
  data: AppData
  setActivePane: (pane: ActivePane) => void
  reload: () => Promise<void>
  showToast: (message: string) => void
  openAdmin: () => void
}) {
  if (pane === 'home') {
    return <HomePane data={data} setActivePane={setActivePane} />
  }
  if (pane === 'notes') {
    return <NotesPane notes={data.notes} />
  }
  if (pane === 'announcements') {
    return <AnnouncementsPane announcements={data.announcements} />
  }
  if (pane === 'checklists') {
    return <ChecklistPane checklists={data.checklists} reload={reload} showToast={showToast} />
  }
  if (pane === 'files') {
    return <FilesPane files={data.files} />
  }
  return (
    <AIHelp
      providers={data.providers}
      data={data}
      openAdmin={openAdmin}
      onActionResult={async (result) => {
        if (result.target_type === 'work_app') {
          const app = data.workApps.find((item) => item.id === result.target_id)
          if (app) setActivePane({ type: 'work-app', app })
        }
        await reload()
      }}
    />
  )
}

function Toolbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="window-toolbar">
      <div className="toolbar-title">
        <h1>{title}</h1>
        {subtitle && <span>{subtitle}</span>}
      </div>
      {actions && <div className="toolbar-actions">{actions}</div>}
    </div>
  )
}

function HomePane({
  data,
  setActivePane,
}: {
  data: AppData
  setActivePane: (pane: ActivePane) => void
}) {
  const importantAnnouncement = data.announcements.find((item) => item.priority === 'important')
  const pinnedNotes = data.notes.filter((note) => note.is_pinned).slice(0, 2)
  const firstChecklist = data.checklists[0]
  const today = new Intl.DateTimeFormat('ja-JP', { dateStyle: 'full' }).format(new Date())

  return (
    <>
      <Toolbar title="今日" subtitle={today} />
      <div className="pane">
        <div className="dashboard-grid">
          {importantAnnouncement && (
            <article className="dashboard-card accent">
              <span className="card-glyph tint-red">
                <Bell />
              </span>
              <h2>{importantAnnouncement.title}</h2>
              <p>{importantAnnouncement.body}</p>
            </article>
          )}
          {pinnedNotes.map((note) => (
            <article className="dashboard-card" key={note.id}>
              <span className="card-glyph tint-yellow">
                <MessageSquare />
              </span>
              <h2>{note.title}</h2>
              <p>{note.body}</p>
            </article>
          ))}
          {firstChecklist && (
            <article className="dashboard-card">
              <span className="card-glyph tint-orange">
                <ClipboardList />
              </span>
              <h2>{firstChecklist.title}</h2>
              <p>
                完了 {firstChecklist.items.filter((item) => item.is_done).length} / {firstChecklist.items.length}
              </p>
            </article>
          )}
        </div>
        <section className="section-block">
          <h2 className="section-heading">業務</h2>
          <div className="app-grid">
            {data.workApps.length === 0 && (
              <div className="empty-state">
                <Briefcase />
                <p>管理画面から業務画面を追加できます。</p>
              </div>
            )}
            {data.workApps.map((app) => (
              <button key={app.id} className="app-tile" onClick={() => setActivePane({ type: 'work-app', app })}>
                <span className="tile-glyph tint-graphite">{icons[app.icon] || <Briefcase />}</span>
                <strong>{app.name}</strong>
                <span className="tile-sub">{app.category}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}

function WorkAppViewer({ app, onClose }: { app: WorkApp; onClose: () => void }) {
  const openExternal = () => window.open(app.url, '_blank', 'noopener,noreferrer')
  return (
    <>
      <div className="window-toolbar">
        <button className="toolbar-button" onClick={onClose} aria-label="戻る">
          <ChevronLeft />
        </button>
        <div className="toolbar-title center">
          <h1>{app.name}</h1>
        </div>
        <div className="toolbar-actions">
          <button className="toolbar-button" onClick={openExternal} aria-label="外部で開く">
            <ExternalLink />
          </button>
        </div>
      </div>
      {app.display_mode === 'embed' ? (
        <div className="iframe-shell">
          <iframe title={app.name} src={app.url} sandbox="allow-forms allow-scripts allow-same-origin allow-popups" />
          <div className="iframe-fallback">
            <span>表示できない場合</span>
            <button onClick={openExternal}>外部で開く</button>
          </div>
        </div>
      ) : (
        <div className="pane external-panel">
          <span className="card-glyph tint-graphite big">
            <Briefcase />
          </span>
          <h2>{app.name}</h2>
          <p className="muted">{app.url}</p>
          <button className="primary-button" onClick={openExternal}>
            開く
          </button>
        </div>
      )}
    </>
  )
}

function NotesPane({ notes }: { notes: Note[] }) {
  return (
    <>
      <Toolbar title="メモ" subtitle={`${notes.length}件`} />
      <div className="pane">
        <div className="list-grid">
          {notes.map((note) => (
            <article className="content-card note-card" key={note.id}>
              <h2>{note.title}</h2>
              <p>{note.body}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function AnnouncementsPane({ announcements }: { announcements: Announcement[] }) {
  return (
    <>
      <Toolbar title="お知らせ" subtitle={`${announcements.length}件`} />
      <div className="pane">
        <div className="list-grid">
          {announcements.map((announcement) => (
            <article
              className={`content-card ${announcement.priority === 'important' ? 'accent-line' : ''}`}
              key={announcement.id}
            >
              <h2>{announcement.title}</h2>
              <p>{announcement.body}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function ChecklistPane({
  checklists,
  reload,
  showToast,
}: {
  checklists: Checklist[]
  reload: () => Promise<void>
  showToast: (message: string) => void
}) {
  const toggleItem = async (checklist: Checklist, item: ChecklistItem) => {
    await patchJson(`/checklists/${checklist.id}/items/${item.id}`, { is_done: !item.is_done })
    await reload()
    showToast('更新しました')
  }

  return (
    <>
      <Toolbar title="チェック" subtitle={`${checklists.length}件`} />
      <div className="pane">
        <div className="list-grid">
          {checklists.map((checklist) => (
            <article className="content-card checklist-card" key={checklist.id}>
              <h2>{checklist.title}</h2>
              {checklist.items.map((item) => (
                <button
                  key={item.id}
                  className={item.is_done ? 'check-row done' : 'check-row'}
                  onClick={() => void toggleItem(checklist, item)}
                >
                  {item.is_done ? <CheckCircle2 /> : <Circle />}
                  <span>{item.label}</span>
                </button>
              ))}
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function FilesPane({ files }: { files: FileItem[] }) {
  return (
    <>
      <Toolbar title="書類棚" subtitle={`${files.length}件`} />
      <div className="pane">
        <div className="app-grid file-grid">
          {files.map((file) => (
            <a className="app-tile" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}>
              <span className="tile-glyph tint-blue">
                <FileText />
              </span>
              <strong>{file.name}</strong>
              <span className="tile-sub">{file.category}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  )
}

function AIHelp({
  providers,
  data,
  openAdmin,
  onActionResult,
}: {
  providers: AIProvider[]
  data: AppData
  openAdmin: () => void
  onActionResult: (result: Record<string, unknown>) => Promise<void>
}) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [actionPrompt, setActionPrompt] = useState('')
  const [proposals, setProposals] = useState<AIActionProposal[]>([])
  const [busy, setBusy] = useState(false)
  const provider = providers.find((item) => item.is_default && item.is_enabled) || providers[0]

  const contextSummary = useMemo(() => {
    return [
      `業務画面${data.workApps.length}件`,
      `メモ${data.notes.length}件`,
      `チェック${data.checklists.length}件`,
    ].join(' / ')
  }, [data])

  const chat = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await postJson<{ message: string }>('/ai/chat', {
        message,
        send_context_summary: contextSummary,
      })
      setReply(result.message)
      setMessage('')
    } finally {
      setBusy(false)
    }
  }

  const plan = async (event: FormEvent) => {
    event.preventDefault()
    const result = await postJson<{ proposals: AIActionProposal[] }>('/ai/actions/plan', { prompt: actionPrompt })
    setProposals(result.proposals)
  }

  const execute = async (proposal: AIActionProposal) => {
    const result = await postJson<{ result: Record<string, unknown> }>('/ai/actions/execute', {
      action_key: proposal.action_key,
      input: proposal.input,
      confirmed: proposal.requires_confirmation,
    })
    await onActionResult(result.result)
  }

  if (!provider) {
    return (
      <>
        <Toolbar title="AI" />
        <div className="pane">
          <div className="empty-state">
            <Bot />
            <p>AI はまだ設定されていません。</p>
            <button className="primary-button" onClick={openAdmin}>
              設定する
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Toolbar title="AI" subtitle={provider.display_name} />
      <div className="pane ai-pane">
        <form className="ai-box" onSubmit={chat}>
          <label>
            <span>質問</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
          </label>
          <div className="ai-row">
            <small>送信: {contextSummary}</small>
            <button className="primary-button" disabled={busy || !message.trim()}>
              送信
            </button>
          </div>
        </form>
        {reply && <article className="content-card ai-reply">{reply}</article>}
        <form className="ai-box" onSubmit={plan}>
          <label>
            <span>操作を依頼</span>
            <input
              value={actionPrompt}
              onChange={(event) => setActionPrompt(event.target.value)}
              placeholder="開店チェックを完了"
            />
          </label>
          <div className="ai-row end">
            <button className="secondary-button">提案を見る</button>
          </div>
        </form>
        <div className="list-grid">
          {proposals.map((proposal) => (
            <article className="content-card" key={`${proposal.action_key}-${proposal.title}`}>
              <h2>{proposal.title}</h2>
              <p>{proposal.summary}</p>
              <button
                className={proposal.requires_confirmation ? 'primary-button' : 'secondary-button'}
                onClick={() => void execute(proposal)}
              >
                {proposal.requires_confirmation ? '確認して実行' : '実行'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </>
  )
}

function AdminLogin({ onBack, onLoggedIn }: { onBack: () => void; onLoggedIn: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await postJson('/session/admin-login', { password })
      onLoggedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    }
  }

  return (
    <div className="login-stage">
      <form className="sheet login-card" onSubmit={submit}>
        <button type="button" className="toolbar-button sheet-close" onClick={onBack} aria-label="閉じる">
          <X />
        </button>
        <span className="login-mark">
          <Lock />
        </span>
        <h1>管理者ログイン</h1>
        <p className="muted">続行するにはパスワードを入力してください</p>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          placeholder="パスワード"
        />
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button">ログイン</button>
      </form>
    </div>
  )
}

function AdminDashboard({
  data,
  reload,
  showToast,
  onStaff,
  onLogout,
}: {
  data: AppData
  reload: () => Promise<void>
  showToast: (message: string) => void
  onStaff: () => void
  onLogout: () => Promise<void>
}) {
  const [tab, setTab] = useState<'apps' | 'share' | 'checks' | 'files' | 'ai' | 'settings'>('apps')

  const tabs = [
    ['apps', <Briefcase />, '業務画面', 'blue'],
    ['share', <MessageSquare />, '共有', 'yellow'],
    ['checks', <ClipboardList />, 'チェック', 'orange'],
    ['files', <Archive />, '書類', 'teal'],
    ['ai', <Bot />, 'AI', 'purple'],
    ['settings', <Settings />, '設定', 'graphite'],
  ] as const

  const sidebar = (
    <>
      <div className="sidebar-group-title">管理</div>
      {tabs.map(([key, icon, label, tint]) => (
        <button
          key={key}
          className={tab === key ? 'sidebar-row active' : 'sidebar-row'}
          onClick={() => setTab(key)}
        >
          <span className={`sidebar-badge tint-${tint}`}>{icon}</span>
          <span className="sidebar-label">{label}</span>
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button className="sidebar-row" onClick={onStaff}>
        <span className="sidebar-badge tint-blue">
          <Home />
        </span>
        <span className="sidebar-label">スタッフ画面</span>
      </button>
      <button className="sidebar-row" onClick={() => void onLogout()}>
        <span className="sidebar-badge tint-red">
          <LogOut />
        </span>
        <span className="sidebar-label">退出</span>
      </button>
    </>
  )

  return (
    <MacWindow sidebar={sidebar}>
      {tab === 'apps' && <AdminApps data={data} reload={reload} showToast={showToast} />}
      {tab === 'share' && <AdminShare data={data} reload={reload} showToast={showToast} />}
      {tab === 'checks' && <AdminChecks data={data} reload={reload} showToast={showToast} />}
      {tab === 'files' && <AdminFiles data={data} reload={reload} showToast={showToast} />}
      {tab === 'ai' && <AdminAI data={data} reload={reload} showToast={showToast} />}
      {tab === 'settings' && <AdminSettings data={data} reload={reload} showToast={showToast} />}
    </MacWindow>
  )
}

function AdminApps({ data, reload, showToast }: AdminProps) {
  const [form, setForm] = useState({
    name: '',
    url: '',
    category: '業務',
    display_mode: 'embed',
    icon: 'briefcase',
    is_staff_visible: true,
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    await postJson('/work-apps', form)
    setForm({ ...form, name: '', url: '' })
    await reload()
    showToast('追加しました')
  }

  return (
    <>
      <Toolbar title="業務画面" />
      <div className="pane">
        <form className="admin-form" onSubmit={submit}>
          <input placeholder="名前" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          <input placeholder="URL" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required />
          <input placeholder="カテゴリ" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} />
          <select value={form.display_mode} onChange={(event) => setForm({ ...form, display_mode: event.target.value })}>
            <option value="embed">画面内</option>
            <option value="external">外部</option>
          </select>
          <button className="primary-button">
            <Plus /> 追加
          </button>
        </form>
        <AdminList>
          {data.workApps.map((app) => (
            <AdminRow
              key={app.id}
              title={app.name}
              subtitle={app.url}
              onDelete={async () => {
                await deleteRequest(`/work-apps/${app.id}`)
                await reload()
              }}
            />
          ))}
        </AdminList>
      </div>
    </>
  )
}

type AdminProps = {
  data: AppData
  reload: () => Promise<void>
  showToast: (message: string) => void
}

function AdminShare({ data, reload, showToast }: AdminProps) {
  const [note, setNote] = useState({ title: '', body: '', is_pinned: true, is_staff_visible: true })
  const [announcement, setAnnouncement] = useState({ title: '', body: '', priority: 'important', is_visible: true })

  return (
    <>
      <Toolbar title="共有" />
      <div className="pane two-columns">
        <div>
          <h2 className="section-heading">メモ</h2>
          <form
            className="admin-form vertical"
            onSubmit={async (event) => {
              event.preventDefault()
              await postJson('/notes', note)
              setNote({ ...note, title: '', body: '' })
              await reload()
              showToast('保存しました')
            }}
          >
            <input placeholder="タイトル" value={note.title} onChange={(event) => setNote({ ...note, title: event.target.value })} required />
            <textarea placeholder="本文" value={note.body} onChange={(event) => setNote({ ...note, body: event.target.value })} />
            <button className="primary-button">保存</button>
          </form>
          <AdminList>
            {data.notes.map((item) => (
              <AdminRow
                key={item.id}
                title={item.title}
                subtitle={item.body}
                onDelete={async () => {
                  await deleteRequest(`/notes/${item.id}`)
                  await reload()
                }}
              />
            ))}
          </AdminList>
        </div>
        <div>
          <h2 className="section-heading">お知らせ</h2>
          <form
            className="admin-form vertical"
            onSubmit={async (event) => {
              event.preventDefault()
              await postJson('/announcements', announcement)
              setAnnouncement({ ...announcement, title: '', body: '' })
              await reload()
              showToast('保存しました')
            }}
          >
            <input placeholder="タイトル" value={announcement.title} onChange={(event) => setAnnouncement({ ...announcement, title: event.target.value })} required />
            <textarea placeholder="本文" value={announcement.body} onChange={(event) => setAnnouncement({ ...announcement, body: event.target.value })} />
            <button className="primary-button">保存</button>
          </form>
          <AdminList>
            {data.announcements.map((item) => (
              <AdminRow
                key={item.id}
                title={item.title}
                subtitle={item.body}
                onDelete={async () => {
                  await deleteRequest(`/announcements/${item.id}`)
                  await reload()
                }}
              />
            ))}
          </AdminList>
        </div>
      </div>
    </>
  )
}

function AdminChecks({ data, reload, showToast }: AdminProps) {
  const [form, setForm] = useState({ title: '', description: '', items: '確認する\n片付ける' })
  return (
    <>
      <Toolbar title="チェック" />
      <div className="pane">
        <form
          className="admin-form vertical"
          onSubmit={async (event) => {
            event.preventDefault()
            await postJson('/checklists', {
              title: form.title,
              description: form.description,
              items: form.items.split('\n').map((item) => item.trim()).filter(Boolean),
              is_staff_visible: true,
            })
            setForm({ title: '', description: '', items: '' })
            await reload()
            showToast('作成しました')
          }}
        >
          <input placeholder="タイトル" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <textarea placeholder="項目を1行ずつ" value={form.items} onChange={(event) => setForm({ ...form, items: event.target.value })} />
          <button className="primary-button">作成</button>
        </form>
        <AdminList>
          {data.checklists.map((item) => (
            <AdminRow
              key={item.id}
              title={item.title}
              subtitle={`${item.items.length}項目`}
              onDelete={async () => {
                await deleteRequest(`/checklists/${item.id}`)
                await reload()
              }}
            />
          ))}
        </AdminList>
      </div>
    </>
  )
}

function AdminFiles({ data, reload, showToast }: AdminProps) {
  const [file, setFile] = useState<File | null>(null)
  return (
    <>
      <Toolbar title="書類" />
      <div className="pane">
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!file) return
            const body = new FormData()
            body.append('upload', file)
            await apiFetch('/files/upload?category=書類&is_staff_visible=true', { method: 'POST', body })
            setFile(null)
            await reload()
            showToast('アップロードしました')
          }}
        >
          <input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <button className="primary-button">
            <Upload /> 登録
          </button>
        </form>
        <AdminList>
          {data.files.map((item) => (
            <AdminRow
              key={item.id}
              title={item.name}
              subtitle={item.category}
              onDelete={async () => {
                await deleteRequest(`/files/${item.id}`)
                await reload()
              }}
            />
          ))}
        </AdminList>
      </div>
    </>
  )
}

function AdminAI({ data, reload, showToast }: AdminProps) {
  const [form, setForm] = useState({
    provider: 'openai_compatible',
    display_name: 'OpenAI互換',
    endpoint_url: '',
    model: 'gpt-4o-mini',
    api_key: '',
    is_default: true,
    is_enabled: true,
  })
  return (
    <>
      <Toolbar title="AI" />
      <div className="pane">
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            await postJson('/ai/providers', form)
            setForm({ ...form, api_key: '' })
            await reload()
            showToast('設定しました')
          }}
        >
          <select value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
            <option value="openai_compatible">OpenAI互換</option>
            <option value="ollama">Ollama</option>
          </select>
          <input placeholder="Endpoint" value={form.endpoint_url} onChange={(event) => setForm({ ...form, endpoint_url: event.target.value })} />
          <input placeholder="Model" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} />
          {form.provider === 'openai_compatible' && (
            <input type="password" placeholder="API Key" value={form.api_key} onChange={(event) => setForm({ ...form, api_key: event.target.value })} />
          )}
          <button className="primary-button">保存</button>
        </form>
        <AdminList>
          {data.providers.map((provider) => (
            <div className="admin-row" key={provider.id}>
              <div>
                <strong>{provider.display_name}</strong>
                <span>{provider.model || provider.provider}</span>
              </div>
              <button
                className="secondary-button"
                onClick={async () => {
                  await postJson(`/ai/providers/${provider.id}/test`, {})
                  showToast('接続できました')
                }}
              >
                テスト
              </button>
            </div>
          ))}
        </AdminList>
      </div>
    </>
  )
}

function AdminSettings({ data, reload, showToast }: AdminProps) {
  const [workspaceName, setWorkspaceName] = useState(data.workspace?.name || '')
  return (
    <>
      <Toolbar title="設定" />
      <div className="pane">
        <form
          className="admin-form"
          onSubmit={async (event) => {
            event.preventDefault()
            await patchJson('/workspace', { name: workspaceName })
            await reload()
            showToast('更新しました')
          }}
        >
          <input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
          <button className="primary-button">保存</button>
        </form>
        <button
          className="secondary-button"
          onClick={async () => {
            const backup = await postJson<{ filename: string }>('/backup/create', {})
            showToast(`${backup.filename} を作成`)
          }}
        >
          設定をエクスポート
        </button>
      </div>
    </>
  )
}

function AdminList({ children }: { children: ReactNode }) {
  return <div className="admin-list">{children}</div>
}

function AdminRow({
  title,
  subtitle,
  onDelete,
}: {
  title: string
  subtitle: string
  onDelete: () => Promise<void>
}) {
  return (
    <div className="admin-row">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <button className="danger-button" onClick={() => void onDelete()}>
        削除
      </button>
    </div>
  )
}
