import {
  Archive,
  Bell,
  Bot,
  Briefcase,
  Calculator,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock as ClockIcon,
  Cloud,
  CloudSun,
  Database,
  ExternalLink,
  FileText,
  FolderClosed,
  HardDrive,
  Home,
  ListChecks,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  StickyNote,
  Sun,
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
type StandardApp = 'notes' | 'announcements' | 'checklists' | 'files' | 'ai'
type ActivePane =
  | { type: 'home' }
  | { type: 'standard'; key: StandardApp }
  | { type: 'work-app'; app: WorkApp }

const emptyData: AppData = {
  workspace: null,
  workApps: [],
  notes: [],
  announcements: [],
  checklists: [],
  files: [],
  providers: [],
}

const workIcons: Record<string, ReactElement> = {
  home: <Home />,
  briefcase: <Briefcase />,
  notes: <MessageSquare />,
  checklist: <ClipboardList />,
  files: <Archive />,
  ai: <Bot />,
  bell: <Bell />,
}

type StandardDef = { key: StandardApp; label: string; icon: ReactElement; tint: string }

const standardApps: StandardDef[] = [
  { key: 'notes', label: 'メモ', icon: <StickyNote />, tint: 'ic-blue' },
  { key: 'announcements', label: 'お知らせ', icon: <Megaphone />, tint: 'ic-orange' },
  { key: 'checklists', label: 'チェック', icon: <ListChecks />, tint: 'ic-green' },
  { key: 'files', label: '書類棚', icon: <FolderClosed />, tint: 'ic-teal' },
  { key: 'ai', label: 'AI', icon: <Sparkles />, tint: 'ic-purple' },
]

function timeAgo(iso?: string) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diff = Date.now() - then
  const min = Math.round(diff / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}時間前`
  const day = Math.round(hr / 24)
  if (day < 30) return `${day}日前`
  return new Intl.DateTimeFormat('ja-JP', { month: 'numeric', day: 'numeric' }).format(then)
}

function fileTint(mime: string): string {
  if (mime?.includes('pdf')) return 'red'
  if (mime?.includes('sheet') || mime?.includes('excel') || mime?.includes('csv')) return 'green'
  if (mime?.includes('image')) return 'amber'
  return ''
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 10000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

export function App() {
  const [isReady, setIsReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [view, setView] = useState<View>('staff')
  const [activePane, setActivePane] = useState<ActivePane>({ type: 'home' })
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

  const goHome = () => {
    setView('staff')
    setActivePane({ type: 'home' })
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

  return (
    <div className="os-shell">
      <div className="os-screen">
        {view === 'staff' && activePane.type === 'home' && (
          <HomeScreen
            data={data}
            open={(pane) => setActivePane(pane)}
            onSearch={() => setPaletteOpen(true)}
            onAdmin={() => setView('admin-login')}
          />
        )}

        {view === 'staff' && activePane.type !== 'home' && (
          <StaffScreen
            data={data}
            activePane={activePane}
            setActivePane={setActivePane}
            onHome={goHome}
            onSearch={() => setPaletteOpen(true)}
            reload={loadData}
            showToast={showToast}
            openAdmin={() => setView('admin-login')}
          />
        )}

        {view === 'admin-login' && (
          <AdminLogin
            onBack={goHome}
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
            onStaff={goHome}
            onLogout={async () => {
              await postJson('/session/logout', {})
              goHome()
            }}
          />
        )}

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
    </div>
  )
}

/* ============================ Home launcher ============================ */

function HomeScreen({
  data,
  open,
  onSearch,
  onAdmin,
}: {
  data: AppData
  open: (pane: ActivePane) => void
  onSearch: () => void
  onAdmin: () => void
}) {
  return (
    <div className="os-scroll">
      <div className="home">
        <div className="home-col left">
          <LauncherGrid open={open} onSearch={onSearch} />
          <FavoritesWidget apps={data.workApps} open={open} onSearch={onSearch} />
        </div>

        <div className="home-col center">
          <Clock />
          <AssistantOrb providers={data.providers} data={data} onOpenAI={() => open({ type: 'standard', key: 'ai' })} />
        </div>

        <div className="home-col right">
          <WeatherWidget />
          <CalendarWidget />
          <div className="home-row-bottom">
            <RecentFilesWidget files={data.files} onMore={() => open({ type: 'standard', key: 'files' })} />
            <SystemStatusWidget data={data} onAdmin={onAdmin} />
          </div>
        </div>
      </div>
    </div>
  )
}

function LauncherGrid({ open, onSearch }: { open: (pane: ActivePane) => void; onSearch: () => void }) {
  return (
    <div className="launch-grid">
      {standardApps.map((app) => (
        <button key={app.key} className="launch-tile" onClick={() => open({ type: 'standard', key: app.key })}>
          <span className={`launch-icon ${app.tint}`}>{app.icon}</span>
          <span className="launch-label">{app.label}</span>
        </button>
      ))}
      <button className="launch-tile" onClick={onSearch}>
        <span className="launch-icon ic-graphite">
          <Search />
        </span>
        <span className="launch-label">検索</span>
      </button>
    </div>
  )
}

function Clock() {
  const now = useClock()
  const time = new Intl.DateTimeFormat('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  const date = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(now)
  return (
    <div className="clock">
      <div className="clock-time">{time}</div>
      <div className="clock-date">{date}</div>
    </div>
  )
}

function AssistantOrb({
  providers,
  data,
  onOpenAI,
}: {
  providers: AIProvider[]
  data: AppData
  onOpenAI: () => void
}) {
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const provider = providers.find((item) => item.is_default && item.is_enabled) || providers[0]

  const contextSummary = useMemo(
    () =>
      [`業務画面${data.workApps.length}件`, `メモ${data.notes.length}件`, `チェック${data.checklists.length}件`].join(
        ' / ',
      ),
    [data],
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!message.trim()) return
    if (!provider) {
      onOpenAI()
      return
    }
    setBusy(true)
    try {
      const result = await postJson<{ message: string }>('/ai/chat', {
        message,
        send_context_summary: contextSummary,
      })
      setReply(result.message)
      setMessage('')
    } catch (error) {
      setReply(error instanceof Error ? error.message : '応答できませんでした')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="orb">
      <div className="orb-core">
        {reply ? (
          <div className="orb-reply">{reply}</div>
        ) : (
          <>
            <span className="orb-spark">
              <Sparkles />
            </span>
            <span className="orb-hint">{provider ? 'なにかお手伝いできますか？' : 'AIアシスタント'}</span>
          </>
        )}
      </div>
      <form className="orb-input" onSubmit={submit}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={provider ? 'メッセージを入力…' : 'AIを設定すると使えます'}
          aria-label="AIへメッセージ"
        />
        <button className="orb-send" disabled={busy || !message.trim()} aria-label="送信">
          <Send />
        </button>
      </form>
    </div>
  )
}

function Widget({
  title,
  onMore,
  children,
  footer,
  className,
}: {
  title: string
  onMore?: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  return (
    <section className={className ? `widget ${className}` : 'widget'}>
      <div className="widget-head">
        <h2>{title}</h2>
        {onMore && (
          <button className="widget-menu" onClick={onMore} aria-label={`${title}を開く`}>
            <MoreHorizontal />
          </button>
        )}
      </div>
      {children}
      {footer}
    </section>
  )
}

type WeatherHour = { time: string; icon: ReactElement; temp: string }

const weatherHours: WeatherHour[] = [
  { time: '14:00', icon: <Sun />, temp: '22°' },
  { time: '15:00', icon: <Cloud />, temp: '23°' },
  { time: '16:00', icon: <Cloud />, temp: '23°' },
  { time: '17:00', icon: <CloudSun />, temp: '22°' },
  { time: '18:00', icon: <Cloud />, temp: '21°' },
]

function WeatherWidget() {
  return (
    <Widget title="天気">
      <div className="weather-now">
        <span className="weather-glyph">
          <CloudSun />
        </span>
        <span className="weather-temp">22°</span>
        <span className="weather-meta">
          <span className="weather-desc">くもり時々晴れ</span>
          <span className="weather-hl">最高 24° / 最低 15°</span>
        </span>
      </div>
      <div className="weather-hours">
        {weatherHours.map((hour) => (
          <div className="weather-hour" key={hour.time}>
            <span className="weather-hour-time">{hour.time}</span>
            <span className="weather-hour-icon">{hour.icon}</span>
            <span className="weather-hour-temp">{hour.temp}</span>
          </div>
        ))}
      </div>
    </Widget>
  )
}

type CalendarEvent = { time: string; label: string; tone: string }

const calendarEvents: CalendarEvent[] = [
  { time: '10:00', label: '朝礼ミーティング', tone: 'blue' },
  { time: '13:30', label: '在庫チェック', tone: 'purple' },
  { time: '16:00', label: '締め作業', tone: 'green' },
]

function CalendarWidget() {
  const today = new Intl.DateTimeFormat('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }).format(
    new Date(),
  )
  return (
    <Widget title="カレンダー">
      <div className="calendar-head">
        <span className="calendar-glyph">
          <Calendar />
        </span>
        <span className="calendar-today">{today}</span>
      </div>
      <div className="row-list">
        {calendarEvents.map((event) => (
          <div className="line-row" key={event.time}>
            <span className="line-time">{event.time}</span>
            <span className={`dot ${event.tone}`} />
            <span className="line-main">{event.label}</span>
          </div>
        ))}
      </div>
    </Widget>
  )
}

function RecentFilesWidget({ files, onMore }: { files: FileItem[]; onMore: () => void }) {
  const recent = files.slice(0, 3)
  return (
    <Widget
      title="書類棚"
      onMore={onMore}
      footer={
        files.length > 0 ? (
          <button className="widget-foot" onClick={onMore}>
            <span>すべて見る</span>
            <ChevronRight />
          </button>
        ) : undefined
      }
    >
      {recent.length === 0 && (
        <div className="widget-empty-block">
          <FolderClosed />
          <span>書類はまだありません</span>
        </div>
      )}
      {recent.length > 0 && (
        <div className="row-list">
          {recent.map((file) => (
            <a
              key={file.id}
              className="line-row"
              href={`/api/files/${file.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className={`file-ico ${fileTint(file.mime_type)}`}>
                <FileText />
              </span>
              <span className="file-meta">
                <strong>{file.name}</strong>
                <span>{timeAgo(file.updated_at) || file.category}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </Widget>
  )
}

function SystemStatusWidget({ data, onAdmin }: { data: AppData; onAdmin: () => void }) {
  const aiReady = data.providers.some((p) => p.is_enabled)
  return (
    <Widget title="接続状態" className="myapps">
      <div>
        <div className="stat-row">
          <span className="stat-ico">
            <Wifi />
          </span>
          <span className="stat-label">接続</span>
          <span className="stat-value">
            <span className="dot green" /> オンライン
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-ico">
            <Bot />
          </span>
          <span className="stat-label">AI</span>
          <span className="stat-value">
            <span className={`dot ${aiReady ? 'green' : 'amber'}`} /> {aiReady ? '接続済み' : '未設定'}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-ico">
            <Database />
          </span>
          <span className="stat-label">データ</span>
          <span className="stat-value">
            <span className="dot green" /> 同期済み
          </span>
        </div>
      </div>
      <button className="widget-foot" onClick={onAdmin}>
        <span>設定・管理</span>
        <ChevronRight />
      </button>
      <button className="fab" onClick={onAdmin} aria-label="設定">
        <Settings />
      </button>
    </Widget>
  )
}

const defaultFavorites: { label: string; icon: ReactElement }[] = [
  { label: '地図', icon: <MapPin /> },
  { label: 'ドライブ', icon: <HardDrive /> },
  { label: '電卓', icon: <Calculator /> },
  { label: '時計', icon: <ClockIcon /> },
  { label: 'カメラ', icon: <Camera /> },
  { label: 'メール', icon: <Mail /> },
]

function FavoritesWidget({
  apps,
  open,
  onSearch,
}: {
  apps: WorkApp[]
  open: (pane: ActivePane) => void
  onSearch: () => void
}) {
  const page = apps.slice(0, 6)
  return (
    <section className="widget favorites">
      <div className="myapps-grid">
        {page.length > 0
          ? page.map((app) => (
              <button key={app.id} className="myapp-tile" onClick={() => open({ type: 'work-app', app })}>
                <span className="myapp-icon">{workIcons[app.icon] || <Briefcase />}</span>
                <span className="myapp-label">{app.name}</span>
              </button>
            ))
          : defaultFavorites.map((app) => (
              <button key={app.label} className="myapp-tile" onClick={onSearch}>
                <span className="myapp-icon">{app.icon}</span>
                <span className="myapp-label">{app.label}</span>
              </button>
            ))}
      </div>
    </section>
  )
}

/* ============================ App frame ============================ */

function AppFrame({
  title,
  subtitle,
  onBack,
  actions,
  nav,
  children,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  actions?: ReactNode
  nav?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="app-frame">
      <header className="frame-bar">
        <button className="frame-back" onClick={onBack} aria-label="ホームへ戻る">
          <ChevronLeft />
        </button>
        <div className="frame-title">
          <h1>{title}</h1>
          {subtitle && <span>{subtitle}</span>}
        </div>
        {actions && <div className="frame-actions">{actions}</div>}
      </header>
      <div className="frame-body">
        {nav && <nav className="frame-nav">{nav}</nav>}
        <main className="frame-main">{children}</main>
      </div>
    </div>
  )
}

function StaffScreen({
  data,
  activePane,
  setActivePane,
  onHome,
  onSearch,
  reload,
  showToast,
  openAdmin,
}: {
  data: AppData
  activePane: ActivePane
  setActivePane: (pane: ActivePane) => void
  onHome: () => void
  onSearch: () => void
  reload: () => Promise<void>
  showToast: (message: string) => void
  openAdmin: () => void
}) {
  if (activePane.type === 'work-app') {
    return <WorkAppViewer app={activePane.app} onBack={onHome} />
  }
  if (activePane.type !== 'standard') {
    return null
  }

  const key = activePane.key
  const meta: Record<StandardApp, { title: string; subtitle: string }> = {
    notes: { title: 'メモ', subtitle: `${data.notes.length}件` },
    announcements: { title: 'お知らせ', subtitle: `${data.announcements.length}件` },
    checklists: { title: 'チェック', subtitle: `${data.checklists.length}件` },
    files: { title: '書類棚', subtitle: `${data.files.length}件` },
    ai: { title: 'AI アシスタント', subtitle: '' },
  }

  return (
    <AppFrame
      title={meta[key].title}
      subtitle={meta[key].subtitle}
      onBack={onHome}
      actions={
        <>
          <button className="icon-button" onClick={onSearch} aria-label="検索">
            <Search />
          </button>
          <button className="icon-button" onClick={() => void reload()} aria-label="更新">
            <RefreshCw />
          </button>
        </>
      }
    >
      {key === 'notes' && <NotesPane notes={data.notes} />}
      {key === 'announcements' && <AnnouncementsPane announcements={data.announcements} />}
      {key === 'checklists' && <ChecklistPane checklists={data.checklists} reload={reload} showToast={showToast} />}
      {key === 'files' && <FilesPane files={data.files} />}
      {key === 'ai' && (
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
      )}
    </AppFrame>
  )
}

function NotesPane({ notes }: { notes: Note[] }) {
  return (
    <div className="pane">
      {notes.length === 0 && (
        <div className="empty-state">
          <StickyNote />
          <p>メモはまだありません。</p>
        </div>
      )}
      <div className="list-grid">
        {notes.map((note) => (
          <article className="content-card note-card" key={note.id}>
            <h2>{note.title}</h2>
            <p>{note.body}</p>
          </article>
        ))}
      </div>
    </div>
  )
}

function AnnouncementsPane({ announcements }: { announcements: Announcement[] }) {
  return (
    <div className="pane">
      {announcements.length === 0 && (
        <div className="empty-state">
          <Megaphone />
          <p>お知らせはまだありません。</p>
        </div>
      )}
      <div className="list-grid">
        {announcements.map((announcement) => (
          <article
            className={`content-card ${announcement.priority === 'important' ? 'accent-line' : ''}`}
            key={announcement.id}
          >
            {announcement.priority === 'important' && <span className="pill red" style={{ marginBottom: 8 }}>重要</span>}
            <h2>{announcement.title}</h2>
            <p>{announcement.body}</p>
          </article>
        ))}
      </div>
    </div>
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
    <div className="pane">
      {checklists.length === 0 && (
        <div className="empty-state">
          <ListChecks />
          <p>チェックリストはまだありません。</p>
        </div>
      )}
      <div className="list-grid">
        {checklists.map((checklist) => (
          <article className="content-card checklist-card" key={checklist.id}>
            <h2>{checklist.title}</h2>
            {checklist.items.map((item) => (
              <button
                key={item.id}
                className={item.is_done ? 'check-line done' : 'check-line'}
                onClick={() => void toggleItem(checklist, item)}
              >
                <span className={item.is_done ? 'check-tick on' : 'check-tick'}>
                  {item.is_done ? <CheckCircle2 /> : <Circle />}
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </article>
        ))}
      </div>
    </div>
  )
}

function FilesPane({ files }: { files: FileItem[] }) {
  return (
    <div className="pane">
      {files.length === 0 && (
        <div className="empty-state">
          <FolderClosed />
          <p>書類はまだありません。</p>
        </div>
      )}
      <div className="app-grid">
        {files.map((file) => (
          <a className="tile" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}>
            <span className={`tile-glyph`}>
              <FileText />
            </span>
            <strong>{file.name}</strong>
            <span className="tile-sub">{file.category || timeAgo(file.updated_at)}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function WorkAppViewer({ app, onBack }: { app: WorkApp; onBack: () => void }) {
  const openExternal = () => window.open(app.url, '_blank', 'noopener,noreferrer')
  return (
    <AppFrame
      title={app.name}
      subtitle={app.category}
      onBack={onBack}
      actions={
        <button className="icon-button" onClick={openExternal} aria-label="外部で開く">
          <ExternalLink />
        </button>
      }
    >
      {app.display_mode === 'embed' ? (
        <div className="iframe-shell">
          <iframe title={app.name} src={app.url} sandbox="allow-forms allow-scripts allow-same-origin allow-popups" />
          <div className="iframe-fallback">
            <span>表示できない場合</span>
            <button className="secondary-button" onClick={openExternal}>
              外部で開く
            </button>
          </div>
        </div>
      ) : (
        <div className="external-panel">
          <span className="tile-glyph">
            <Briefcase />
          </span>
          <h2>{app.name}</h2>
          <p className="muted">{app.url}</p>
          <button className="primary-button" onClick={openExternal}>
            開く
          </button>
        </div>
      )}
    </AppFrame>
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
      <div className="pane">
        <div className="empty-state">
          <Sparkles />
          <p>AI はまだ設定されていません。</p>
          <button className="primary-button" onClick={openAdmin}>
            設定する
          </button>
        </div>
      </div>
    )
  }

  return (
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
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            >
              {proposal.requires_confirmation ? '確認して実行' : '実行'}
            </button>
          </article>
        ))}
      </div>
    </div>
  )
}

/* ============================ Command palette ============================ */

type SearchHit = {
  id: string
  title: string
  subtitle: string
  group: string
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
        icon: workIcons[app.icon] || <Briefcase />,
        target: { type: 'work-app', app },
      }),
    )
    data.notes.forEach((note) =>
      all.push({
        id: `note-${note.id}`,
        title: note.title,
        subtitle: note.body,
        group: 'メモ',
        icon: <StickyNote />,
        target: { type: 'standard', key: 'notes' },
      }),
    )
    data.announcements.forEach((item) =>
      all.push({
        id: `ann-${item.id}`,
        title: item.title,
        subtitle: item.body,
        group: 'お知らせ',
        icon: <Megaphone />,
        target: { type: 'standard', key: 'announcements' },
      }),
    )
    data.checklists.forEach((item) =>
      all.push({
        id: `chk-${item.id}`,
        title: item.title,
        subtitle: `${item.items.length}項目`,
        group: 'チェック',
        icon: <ListChecks />,
        target: { type: 'standard', key: 'checklists' },
      }),
    )
    data.files.forEach((file) =>
      all.push({
        id: `file-${file.id}`,
        title: file.name,
        subtitle: file.category || '書類',
        group: '書類棚',
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
              <span className="palette-badge">{hit.icon}</span>
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

/* ============================ Splash / setup / login ============================ */

function Splash() {
  return (
    <div className="os-shell center-screen">
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
    <div className="os-shell center-screen">
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
        <button type="button" className="icon-button sheet-close" onClick={onBack} aria-label="閉じる">
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

/* ============================ Admin ============================ */

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
    ['apps', <Briefcase />, '業務画面'],
    ['share', <MessageSquare />, '共有'],
    ['checks', <ClipboardList />, 'チェック'],
    ['files', <Archive />, '書類'],
    ['ai', <Bot />, 'AI'],
    ['settings', <Settings />, '設定'],
  ] as const

  const title = tabs.find(([key]) => key === tab)?.[2] || '管理'

  const nav = (
    <>
      <div className="nav-group">管理</div>
      {tabs.map(([key, icon, label]) => (
        <button
          key={key}
          className={tab === key ? 'nav-row active' : 'nav-row'}
          onClick={() => setTab(key)}
        >
          <span className="nav-badge">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
      <div className="nav-spacer" />
      <button className="nav-row" onClick={onStaff}>
        <span className="nav-badge">
          <Home />
        </span>
        <span>ホーム画面</span>
      </button>
      <button className="nav-row" onClick={() => void onLogout()}>
        <span className="nav-badge">
          <LogOut />
        </span>
        <span>退出</span>
      </button>
    </>
  )

  return (
    <AppFrame title={title} subtitle="管理" onBack={onStaff} nav={nav}>
      {tab === 'apps' && <AdminApps data={data} reload={reload} showToast={showToast} />}
      {tab === 'share' && <AdminShare data={data} reload={reload} showToast={showToast} />}
      {tab === 'checks' && <AdminChecks data={data} reload={reload} showToast={showToast} />}
      {tab === 'files' && <AdminFiles data={data} reload={reload} showToast={showToast} />}
      {tab === 'ai' && <AdminAI data={data} reload={reload} showToast={showToast} />}
      {tab === 'settings' && <AdminSettings data={data} reload={reload} showToast={showToast} />}
    </AppFrame>
  )
}

type AdminProps = {
  data: AppData
  reload: () => Promise<void>
  showToast: (message: string) => void
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
  )
}

function AdminShare({ data, reload, showToast }: AdminProps) {
  const [note, setNote] = useState({ title: '', body: '', is_pinned: true, is_staff_visible: true })
  const [announcement, setAnnouncement] = useState({ title: '', body: '', priority: 'important', is_visible: true })

  return (
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
  )
}

function AdminChecks({ data, reload, showToast }: AdminProps) {
  const [form, setForm] = useState({ title: '', description: '', items: '確認する\n片付ける' })
  return (
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
  )
}

function AdminFiles({ data, reload, showToast }: AdminProps) {
  const [file, setFile] = useState<File | null>(null)
  return (
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
  )
}

function AdminSettings({ data, reload, showToast }: AdminProps) {
  const [workspaceName, setWorkspaceName] = useState(data.workspace?.name || '')
  return (
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
        style={{ marginTop: 8 }}
        onClick={async () => {
          const backup = await postJson<{ filename: string }>('/backup/create', {})
          showToast(`${backup.filename} を作成`)
        }}
      >
        設定をエクスポート
      </button>
    </div>
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
