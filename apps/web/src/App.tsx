import {
  Archive,
  Bell,
  Bot,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
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
  Settings,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactElement, ReactNode } from 'react'
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

export function App() {
  const [isReady, setIsReady] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [view, setView] = useState<View>('staff')
  const [activePane, setActivePane] = useState<ActivePane>({ type: 'standard', key: 'home' })
  const [data, setData] = useState<AppData>(emptyData)
  const [toast, setToast] = useState('')

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
    <div className="app-shell">
      <div className="lake-bg" aria-hidden="true" />
      <TopBar
        workspace={data.workspace}
        view={view}
        onStaff={() => {
          setView('staff')
          setActivePane({ type: 'standard', key: 'home' })
        }}
        onAdmin={() => setView(view === 'admin' ? 'staff' : 'admin-login')}
        onRefresh={() => void loadData()}
      />
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
          onLogout={async () => {
            await postJson('/session/logout', {})
            setView('staff')
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Splash() {
  return (
    <main className="app-shell center-screen">
      <div className="lake-bg" aria-hidden="true" />
      <section className="glass splash">
        <Sparkles />
        <h1>Marmo Lake</h1>
      </section>
    </main>
  )
}

function TopBar({
  workspace,
  view,
  onStaff,
  onAdmin,
  onRefresh,
}: {
  workspace: Workspace | null
  view: View
  onStaff: () => void
  onAdmin: () => void
  onRefresh: () => void
}) {
  return (
    <header className="top-bar glass">
      <button className="brand" onClick={onStaff} aria-label="スタッフホーム">
        <span className="brand-mark">ML</span>
        <span>{workspace?.name || 'Marmo Lake'}</span>
      </button>
      <nav className="top-actions">
        <button className="icon-button" onClick={onRefresh} aria-label="更新">
          <RefreshCw />
        </button>
        <button className="icon-button" onClick={onAdmin} aria-label="管理">
          {view === 'admin' ? <Home /> : <Lock />}
        </button>
      </nav>
    </header>
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
    <main className="app-shell setup-screen">
      <div className="lake-bg" aria-hidden="true" />
      <form className="glass setup-card" onSubmit={submit}>
        <div className="setup-heading">
          <span className="brand-mark">ML</span>
          <div>
            <h1>Marmo Lake</h1>
            <p>最初のワークスペースを作成</p>
          </div>
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
            <span>AI</span>
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
          {saving ? '作成中' : '開始'}
        </button>
      </form>
    </main>
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
  const standardApps = [
    { key: 'home', label: 'ホーム', icon: <LayoutDashboard /> },
    { key: 'notes', label: 'メモ', icon: <MessageSquare /> },
    { key: 'announcements', label: 'お知らせ', icon: <Bell /> },
    { key: 'checklists', label: 'チェック', icon: <ClipboardList /> },
    { key: 'files', label: '書類棚', icon: <Archive /> },
    { key: 'ai', label: 'AI', icon: <Bot /> },
  ] as const

  return (
    <main className="workspace">
      <aside className="dock glass" aria-label="ランチャー">
        {standardApps.map((item) => (
          <button
            key={item.key}
            className={activePane.type === 'standard' && activePane.key === item.key ? 'active' : ''}
            onClick={() => setActivePane({ type: 'standard', key: item.key })}
            title={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </aside>
      <section className="main-stage glass">
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
      </section>
    </main>
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

  return (
    <div className="pane">
      <div className="pane-title">
        <h1>今日</h1>
        <span>{new Intl.DateTimeFormat('ja-JP', { dateStyle: 'medium' }).format(new Date())}</span>
      </div>
      <div className="dashboard-grid">
        {importantAnnouncement && (
          <article className="dashboard-card accent">
            <Bell />
            <h2>{importantAnnouncement.title}</h2>
            <p>{importantAnnouncement.body}</p>
          </article>
        )}
        {pinnedNotes.map((note) => (
          <article className="dashboard-card" key={note.id}>
            <MessageSquare />
            <h2>{note.title}</h2>
            <p>{note.body}</p>
          </article>
        ))}
        {firstChecklist && (
          <article className="dashboard-card">
            <ClipboardList />
            <h2>{firstChecklist.title}</h2>
            <p>
              {firstChecklist.items.filter((item) => item.is_done).length}/{firstChecklist.items.length}
            </p>
          </article>
        )}
      </div>
      <section className="section-block">
        <h2>業務</h2>
        <div className="app-grid">
          {data.workApps.length === 0 && (
            <div className="empty-state">
              <Briefcase />
              <p>管理画面から業務画面を追加できます。</p>
            </div>
          )}
          {data.workApps.map((app) => (
            <button key={app.id} className="app-tile" onClick={() => setActivePane({ type: 'work-app', app })}>
              {icons[app.icon] || <Briefcase />}
              <strong>{app.name}</strong>
              <span>{app.category}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function WorkAppViewer({ app, onClose }: { app: WorkApp; onClose: () => void }) {
  const openExternal = () => window.open(app.url, '_blank', 'noopener,noreferrer')
  return (
    <div className="viewer">
      <div className="viewer-bar">
        <button className="icon-button" onClick={onClose} aria-label="戻る">
          <ChevronLeft />
        </button>
        <strong>{app.name}</strong>
        <button className="icon-button" onClick={openExternal} aria-label="外部で開く">
          <ExternalLink />
        </button>
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
        <div className="external-panel">
          <Briefcase />
          <h2>{app.name}</h2>
          <button className="primary-button" onClick={openExternal}>
            開く
          </button>
        </div>
      )}
    </div>
  )
}

function NotesPane({ notes }: { notes: Note[] }) {
  return (
    <div className="pane">
      <div className="pane-title">
        <h1>メモ</h1>
      </div>
      <div className="list-grid">
        {notes.map((note) => (
          <article className="content-card" key={note.id}>
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
      <div className="pane-title">
        <h1>お知らせ</h1>
      </div>
      <div className="list-grid">
        {announcements.map((announcement) => (
          <article className={`content-card ${announcement.priority === 'important' ? 'accent-line' : ''}`} key={announcement.id}>
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
      <div className="pane-title">
        <h1>チェック</h1>
      </div>
      <div className="list-grid">
        {checklists.map((checklist) => (
          <article className="content-card checklist-card" key={checklist.id}>
            <h2>{checklist.title}</h2>
            {checklist.items.map((item) => (
              <button key={item.id} className={item.is_done ? 'check-row done' : 'check-row'} onClick={() => void toggleItem(checklist, item)}>
                <CheckCircle2 />
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
      <div className="pane-title">
        <h1>書類棚</h1>
      </div>
      <div className="app-grid file-grid">
        {files.map((file) => (
          <a className="app-tile" href={`/api/files/${file.id}`} target="_blank" rel="noreferrer" key={file.id}>
            <FileText />
            <strong>{file.name}</strong>
            <span>{file.category}</span>
          </a>
        ))}
      </div>
    </div>
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
      <div className="pane ai-pane">
        <div className="empty-state">
          <Bot />
          <h1>AI未設定</h1>
          <button className="primary-button" onClick={openAdmin}>
            設定
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pane ai-pane">
      <div className="pane-title">
        <h1>AI</h1>
        <span>{provider.display_name}</span>
      </div>
      <form className="ai-box" onSubmit={chat}>
        <label>
          <span>質問</span>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} required />
        </label>
        <small>送信: {contextSummary}</small>
        <button className="primary-button" disabled={busy || !message.trim()}>
          送信
        </button>
      </form>
      {reply && <article className="content-card ai-reply">{reply}</article>}
      <form className="ai-box" onSubmit={plan}>
        <label>
          <span>操作</span>
          <input
            value={actionPrompt}
            onChange={(event) => setActionPrompt(event.target.value)}
            placeholder="開店チェックを完了"
          />
        </label>
        <button>提案</button>
      </form>
      <div className="list-grid">
        {proposals.map((proposal) => (
          <article className="content-card" key={`${proposal.action_key}-${proposal.title}`}>
            <h2>{proposal.title}</h2>
            <p>{proposal.summary}</p>
            <button className={proposal.requires_confirmation ? 'primary-button' : ''} onClick={() => void execute(proposal)}>
              {proposal.requires_confirmation ? '確認して実行' : '実行'}
            </button>
          </article>
        ))}
      </div>
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
    <main className="admin-login">
      <form className="glass login-card" onSubmit={submit}>
        <button type="button" className="icon-button" onClick={onBack} aria-label="戻る">
          <X />
        </button>
        <Lock />
        <h1>管理</h1>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          placeholder="パスワード"
        />
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button">入る</button>
      </form>
    </main>
  )
}

function AdminDashboard({
  data,
  reload,
  showToast,
  onLogout,
}: {
  data: AppData
  reload: () => Promise<void>
  showToast: (message: string) => void
  onLogout: () => Promise<void>
}) {
  const [tab, setTab] = useState<'apps' | 'share' | 'checks' | 'files' | 'ai' | 'settings'>('apps')

  return (
    <main className="admin-layout">
      <aside className="admin-nav glass">
        {[
          ['apps', <Briefcase />, '画面'],
          ['share', <MessageSquare />, '共有'],
          ['checks', <ClipboardList />, 'チェック'],
          ['files', <Archive />, '書類'],
          ['ai', <Bot />, 'AI'],
          ['settings', <Settings />, '設定'],
        ].map(([key, icon, label]) => (
          <button key={key as string} className={tab === key ? 'active' : ''} onClick={() => setTab(key as typeof tab)}>
            {icon as ReactElement}
            <span>{label as string}</span>
          </button>
        ))}
        <button onClick={() => void onLogout()}>
          <LogOut />
          <span>退出</span>
        </button>
      </aside>
      <section className="admin-panel glass">
        {tab === 'apps' && <AdminApps data={data} reload={reload} showToast={showToast} />}
        {tab === 'share' && <AdminShare data={data} reload={reload} showToast={showToast} />}
        {tab === 'checks' && <AdminChecks data={data} reload={reload} showToast={showToast} />}
        {tab === 'files' && <AdminFiles data={data} reload={reload} showToast={showToast} />}
        {tab === 'ai' && <AdminAI data={data} reload={reload} showToast={showToast} />}
        {tab === 'settings' && <AdminSettings data={data} reload={reload} showToast={showToast} />}
      </section>
    </main>
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
    <div className="admin-section">
      <h1>業務画面</h1>
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
          <AdminRow key={app.id} title={app.name} subtitle={app.url} onDelete={async () => {
            await deleteRequest(`/work-apps/${app.id}`)
            await reload()
          }} />
        ))}
      </AdminList>
    </div>
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
    <div className="admin-section two-columns">
      <div>
        <h1>メモ</h1>
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
            <AdminRow key={item.id} title={item.title} subtitle={item.body} onDelete={async () => {
              await deleteRequest(`/notes/${item.id}`)
              await reload()
            }} />
          ))}
        </AdminList>
      </div>
      <div>
        <h1>お知らせ</h1>
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
            <AdminRow key={item.id} title={item.title} subtitle={item.body} onDelete={async () => {
              await deleteRequest(`/announcements/${item.id}`)
              await reload()
            }} />
          ))}
        </AdminList>
      </div>
    </div>
  )
}

function AdminChecks({ data, reload, showToast }: AdminProps) {
  const [form, setForm] = useState({ title: '', description: '', items: '確認する\n片付ける' })
  return (
    <div className="admin-section">
      <h1>チェック</h1>
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
          <AdminRow key={item.id} title={item.title} subtitle={`${item.items.length}項目`} onDelete={async () => {
            await deleteRequest(`/checklists/${item.id}`)
            await reload()
          }} />
        ))}
      </AdminList>
    </div>
  )
}

function AdminFiles({ data, reload, showToast }: AdminProps) {
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="admin-section">
      <h1>書類棚</h1>
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
          <AdminRow key={item.id} title={item.name} subtitle={item.category} onDelete={async () => {
            await deleteRequest(`/files/${item.id}`)
            await reload()
          }} />
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
    <div className="admin-section">
      <h1>AI</h1>
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
              onClick={async () => {
                await postJson(`/ai/providers/${provider.id}/test`, {})
                showToast('接続できました')
              }}
            >
              Test
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
    <div className="admin-section">
      <h1>設定</h1>
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
        className="primary-button"
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
      <button onClick={() => void onDelete()}>削除</button>
    </div>
  )
}
