import { useEffect, useState } from 'react'
import {
  AlarmClock,
  BarChart3,
  Check,
  ClipboardList,
  Copy,
  Gauge,
  Keyboard,
  Link2,
  ListTodo,
  Palette,
  Plus,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { useCopy } from '@/hooks'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import {
  addPoll,
  addTask,
  addTodo,
  applyHostSettings,
  closePoll,
  deletePoll,
  deleteTask,
  deleteTodo,
  pauseTimer,
  resetTimer,
  resumeTimer,
  setTaskAssignee,
  setTaskNote,
  startTimer,
  toggleTask,
  toggleTodo,
  votePoll,
} from '@/features/room/session/sessionController'
import { buildInviteLink } from '@/lib/invite'
import { formatDuration } from '@/lib/utils'
import type { ActivityTask, RoomBackground } from '@/types'

const BACKGROUNDS: { value: RoomBackground; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'grid', label: 'Grid' },
  { value: 'aurora', label: 'Aurora' },
  { value: 'solid', label: 'Solid' },
]

type ActivityTab = 'polls' | 'tasks' | 'todos' | 'timer'

const TAB_OPTIONS: { value: ActivityTab; label: string }[] = [
  { value: 'polls', label: 'Polls' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'todos', label: 'To-do' },
  { value: 'timer', label: 'Timer' },
]

export function ActivitiesPanel() {
  const navigate = useNavigate()
  const { roomId } = useParams()
  const room = useRoomSessionStore((state) => state.room)
  const self = useRoomSessionStore((state) => state.self)
  const markActivitiesRead = useRoomSessionStore((state) => state.markActivitiesRead)
  const setPanel = useUiStore((state) => state.setPanel)
  const setModal = useUiStore((state) => state.setModal)
  const setShortcutsOpen = useUiStore((state) => state.setShortcutsOpen)
  const lowBandwidth = useCallStore((state) => state.lowBandwidth)
  const setLowBandwidth = useCallStore((state) => state.setLowBandwidth)
  const { copied, copy } = useCopy()
  const t = useT()
  const [tab, setTab] = useState<ActivityTab>('polls')

  useEffect(() => {
    markActivitiesRead()
  }, [markActivitiesRead])

  if (!room) return null
  const isHost = self?.role === 'host'
  const canManageRoom = isHost || Boolean(self?.permissions?.canManageRoom)
  const link = typeof window !== 'undefined' ? buildInviteLink(room) : ''

  return (
    <div className="h-full space-y-5 overflow-y-auto nx-scroll px-3 py-3.5">
      <section>
        <SectionTitle icon={<Users className="h-3.5 w-3.5" />} title="People" />
        <div className="mt-2 space-y-2">
          <ToolRow
            icon={<Users className="h-4 w-4" />}
            title="People in the room"
            description="Manage participants, requests and permissions."
            action="Open"
            onClick={() => setPanel('participants')}
          />
          <ToolRow
            icon={<UserPlus className="h-4 w-4" />}
            title="Invite people"
            description="Share a link or room code."
            action="Open"
            onClick={() => setModal('invite')}
          />
          <ToolRow
            icon={copied ? <Copy className="h-4 w-4 text-success" /> : <Link2 className="h-4 w-4" />}
            title={copied ? 'Link copied' : 'Copy room link'}
            description={link.replace(/^https?:\/\//, '')}
            action={copied ? 'Copied' : 'Copy'}
            onClick={() => void copy(link)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={<Sparkles className="h-3.5 w-3.5" />} title="Games & tasks" />
        <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
          <Segmented
            ariaLabel={t('Activity type')}
            value={tab}
            onChange={setTab}
            options={TAB_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
            size="sm"
            className="w-full"
          />
          <div className="mt-3">
            {tab === 'polls' ? <PollsSection /> : null}
            {tab === 'tasks' ? <TasksSection /> : null}
            {tab === 'todos' ? <TodosSection /> : null}
            {tab === 'timer' ? <TimerSection /> : null}
          </div>
        </div>
      </section>

      <section>
        <SectionTitle icon={<SlidersHorizontal className="h-3.5 w-3.5" />} title="Call controls" />
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
              <Gauge className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">{t('Low bandwidth mode')}</p>
              <p className="text-[12px] text-ink-subtle">{t('Caps video quality to save data.')}</p>
            </div>
            <Switch checked={lowBandwidth} onCheckedChange={setLowBandwidth} aria-label={t('Low bandwidth mode')} />
          </div>
          <ToolRow
            icon={<SlidersHorizontal className="h-4 w-4" />}
            title="Devices"
            description="Microphone, camera and speaker."
            action="Adjust"
            onClick={() => setModal('devices')}
          />
          <ToolRow
            icon={<Keyboard className="h-4 w-4" />}
            title="Keyboard shortcuts"
            description="Mute, camera, chat and more."
            action="View"
            onClick={() => setShortcutsOpen(true)}
          />
        </div>
      </section>

      <section>
        <SectionTitle icon={<Palette className="h-3.5 w-3.5" />} title="Room background" />
        <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
          <div className={canManageRoom ? undefined : 'pointer-events-none opacity-60'}>
            <Segmented
              ariaLabel={t('Room background')}
              value={room.settings.appearance.background}
              onChange={(value) => applyHostSettings({ appearance: { background: value } })}
              options={BACKGROUNDS.map((option) => ({ ...option, label: t(option.label) }))}
              size="sm"
              className="w-full"
            />
          </div>
          <p className="mt-2 text-[12px] text-ink-subtle">
            {canManageRoom
              ? t('Applies to the video stage for everyone.')
              : t('Only the host can change this.')}
          </p>
        </div>
      </section>

      <section>
        <SectionTitle icon={<Settings className="h-3.5 w-3.5" />} title="Host" />
        <div className="mt-2 space-y-2">
          {isHost ? (
            <ToolRow
              icon={<Settings className="h-4 w-4" />}
              title="Room settings"
              description="Access, AV, chat, security."
              action="Open"
              onClick={() => navigate(`/room/${roomId}/settings`)}
            />
          ) : (
            <ToolRow
              icon={<Settings className="h-4 w-4" />}
              title={t('Hosted by {name}', { name: room.hostName })}
              description="Settings are controlled by the host."
              action=""
              onClick={() => undefined}
            />
          )}
        </div>
      </section>
    </div>
  )
}

function useActivityPermissions() {
  const self = useRoomSessionStore((state) => state.self)
  return {
    canEdit: (createdBy: string) =>
      Boolean(self && (self.role === 'host' || self.permissions?.canModerate || self.id === createdBy)),
    selfId: self?.id ?? null,
  }
}

function PollsSection() {
  const polls = useRoomSessionStore((state) => state.polls)
  const self = useRoomSessionStore((state) => state.self)
  const { canEdit } = useActivityPermissions()
  const t = useT()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  function submit() {
    addPoll(question, options)
    setQuestion('')
    setOptions(['', ''])
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t('Ask the room a question…')}
          aria-label={t('Poll question')}
          className="h-9 text-[13px]"
        />
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <Input
              value={option}
              onChange={(event) =>
                setOptions(options.map((value, i) => (i === index ? event.target.value : value)))
              }
              placeholder={t('Option {index}', { index: index + 1 })}
              aria-label={t('Poll option {index}', { index: index + 1 })}
              className="h-9 text-[13px]"
            />
            {options.length > 2 ? (
              <button
                type="button"
                aria-label={t('Remove option {index}', { index: index + 1 })}
                onClick={() => setOptions(options.filter((_, i) => i !== index))}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOptions([...options, ''])}
            disabled={options.length >= 6}
          >
            <Plus className="h-3.5 w-3.5" />
            {t('Option')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={submit}
            disabled={!question.trim() || options.filter((option) => option.trim()).length < 2}
          >
            {t('Add poll')}
          </Button>
        </div>
      </div>

      {polls.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title={t('No polls yet')}
          description={t('Start a quick vote — everyone can vote live.')}
          className="py-6"
        />
      ) : (
        [...polls].reverse().map((poll) => {
          const totalVotes = poll.options.reduce((sum, option) => sum + option.votes.length, 0)
          return (
            <div key={poll.id} className="space-y-2 rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-[13.5px] font-medium text-ink">{poll.question}</p>
                {poll.closed ? (
                  <Badge variant="accent" className="shrink-0">
                    {t('Closed')}
                  </Badge>
                ) : canEdit(poll.createdBy) ? (
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-[12px]" onClick={() => closePoll(poll.id)}>
                    {t('Close')}
                  </Button>
                ) : null}
                {canEdit(poll.createdBy) ? (
                  <button
                    type="button"
                    aria-label={t('Delete poll')}
                    onClick={() => deletePoll(poll.id)}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="space-y-1.5">
                {poll.options.map((option) => {
                  const percentage = totalVotes > 0 ? Math.round((option.votes.length / totalVotes) * 100) : 0
                  const mine = Boolean(self && option.votes.includes(self.id))
                  return (
                    <button
                      key={option.id}
                      type="button"
                      disabled={poll.closed}
                      onClick={() => votePoll(poll.id, option.id)}
                      className={cn(
                        'relative w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors',
                        poll.closed ? 'cursor-default border-line bg-surface-2' : 'border-line hover:border-line-strong',
                        mine && 'border-accent/60',
                      )}
                    >
                      <span
                        className={cn('absolute inset-y-0 left-0 transition-all', mine ? 'bg-accent-soft' : 'bg-surface-3')}
                        style={{ width: `${percentage}%` }}
                        aria-hidden
                      />
                      <span className="relative flex items-center gap-2 text-[13px] text-ink">
                        {mine ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
                        <span className="min-w-0 flex-1 truncate">{option.text}</span>
                        <span className="shrink-0 font-mono text-[11.5px] text-ink-subtle">
                          {option.votes.length} · {percentage}%
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11.5px] text-ink-subtle">
                {poll.closed
                  ? t('{count} votes · click to view', { count: totalVotes })
                  : t('{count} votes · click to vote', { count: totalVotes })}
              </p>
            </div>
          )
        })
      )}
    </div>
  )
}

function TasksSection() {
  const tasks = useRoomSessionStore((state) => state.tasks)
  const participants = useRoomSessionStore((state) => state.participants)
  const t = useT()
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  function submit() {
    addTask(title, assigneeId || null)
    setTitle('')
    setAssigneeId('')
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl border border-line bg-surface p-3">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder={t('What needs to get done?')}
          aria-label={t('Task title')}
          className="h-9 text-[13px]"
        />
        <div className="flex items-center gap-2">
          <select
            value={assigneeId}
            onChange={(event) => setAssigneeId(event.target.value)}
            aria-label={t('Assign to')}
            className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
          >
            <option value="">{t('No assignee')}</option>
            {participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
                {participant.isSelf ? ` ${t('(You)')}` : ''}
              </option>
            ))}
          </select>
          <Button variant="primary" size="sm" onClick={submit} disabled={!title.trim()}>
            {t('Add task')}
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title={t('No tasks yet')}
          description={t('Assign work to someone and track it live.')}
          className="py-6"
        />
      ) : (
        tasks.map((task) => <TaskRow key={task.id} task={task} />)
      )}
    </div>
  )
}

function TaskRow({ task }: { task: ActivityTask }) {
  const participants = useRoomSessionStore((state) => state.participants)
  const self = useRoomSessionStore((state) => state.self)
  const { canEdit } = useActivityPermissions()
  const t = useT()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(task.note)
  const editable = canEdit(task.createdBy)

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          aria-label={task.done ? t('Mark as not done') : t('Mark as done')}
          onClick={() => toggleTask(task.id)}
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
            task.done ? 'border-accent bg-accent-solid text-white' : 'border-line bg-surface-2 hover:border-line-strong',
          )}
        >
          {task.done ? <Check className="h-3.5 w-3.5" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[13.5px] leading-snug', task.done ? 'text-ink-subtle line-through' : 'text-ink')}>
            {task.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <select
              value={task.assigneeId ?? ''}
              onChange={(event) => setTaskAssignee(task.id, event.target.value || null)}
              aria-label={t('Assignee')}
              className="h-7 max-w-[140px] rounded-lg border border-line bg-surface-2 px-2 text-[12px] text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
            >
              <option value="">{t('Unassigned')}</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                  {participant.isSelf ? ` ${t('(You)')}` : ''}
                </option>
              ))}
            </select>
            {task.assigneeId && task.assigneeId === self?.id ? (
              <Badge variant="accent" className="text-[11px]">
                {t('Yours')}
              </Badge>
            ) : null}
            {editable ? (
              <>
                <button
                  type="button"
                  onClick={() => setNoteOpen((open) => !open)}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-[11.5px] transition-colors',
                    noteOpen || task.note ? 'text-accent hover:bg-accent-soft' : 'text-ink-subtle hover:bg-surface-3',
                  )}
                >
                  {task.note ? t('Note ✓') : t('Note')}
                </button>
                <button
                  type="button"
                  aria-label={t('Delete task')}
                  onClick={() => deleteTask(task.id)}
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {noteOpen && editable ? (
        <Textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          onBlur={() => {
            if (noteDraft !== task.note) setTaskNote(task.id, noteDraft)
          }}
          placeholder={t('Add a note for this task…')}
          className="mt-2 min-h-[60px] text-[13px]"
        />
      ) : null}
    </div>
  )
}

function TodosSection() {
  const todos = useRoomSessionStore((state) => state.todos)
  const { canEdit } = useActivityPermissions()
  const t = useT()
  const [text, setText] = useState('')

  const doneCount = todos.filter((todo) => todo.done).length

  function submit() {
    addTodo(text)
    setText('')
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
          placeholder={t('Add an item to the shared list…')}
          aria-label={t('To-do item')}
          className="h-9 text-[13px]"
        />
        <Button variant="primary" size="sm" onClick={submit} disabled={!text.trim()}>
          {t('Add')}
        </Button>
      </div>

      {todos.length > 0 ? (
        <p className="text-[11.5px] text-ink-subtle">
          {t('{done}/{total} done', { done: doneCount, total: todos.length })}
        </p>
      ) : null}

      {todos.length === 0 ? (
        <EmptyState
          icon={<ListTodo className="h-5 w-5" />}
          title={t('Nothing on the list')}
          description={t('A shared checklist for everyone in the room.')}
          className="py-6"
        />
      ) : (
        <div className="space-y-1.5">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="group flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2"
            >
              <button
                type="button"
                aria-label={todo.done ? t('Mark as not done') : t('Mark as done')}
                onClick={() => toggleTodo(todo.id)}
                className={cn(
                  'grid h-4.5 w-4.5 shrink-0 place-items-center rounded-md border transition-colors',
                  todo.done ? 'border-accent bg-accent-solid text-white' : 'border-line bg-surface-2 hover:border-line-strong',
                )}
                style={{ height: 18, width: 18 }}
              >
                {todo.done ? <Check className="h-3 w-3" /> : null}
              </button>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[13px]',
                  todo.done ? 'text-ink-subtle line-through' : 'text-ink',
                )}
              >
                {todo.text}
              </span>
              {canEdit(todo.createdBy) ? (
                <button
                  type="button"
                  aria-label={t('Delete to-do item')}
                  onClick={() => deleteTodo(todo.id)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-subtle opacity-0 transition-opacity hover:bg-surface-3 hover:text-danger focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TIMER_PRESETS: { value: string; label: string }[] = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '10', label: '10m' },
  { value: '25', label: '25m' },
]

function TimerSection() {
  const timer = useRoomSessionStore((state) => state.timer)
  const t = useT()
  const [, setTick] = useState(0)
  const [minutes, setMinutes] = useState('5')
  const running = Boolean(timer?.running)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((tick) => tick + 1), 300)
    return () => window.clearInterval(id)
  }, [running])

  const remainingMs = timer
    ? timer.running && timer.endsAt
      ? Math.max(0, timer.endsAt - Date.now())
      : timer.remainingMs
    : 0
  const finished = Boolean(timer?.running) && remainingMs <= 0
  const totalMs = timer?.remainingMs && timer.remainingMs > 0 ? timer.remainingMs : 1
  const progress = timer ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0

  function start() {
    const value = Number.parseFloat(minutes)
    if (!Number.isFinite(value) || value <= 0) return
    startTimer(Math.round(value * 60_000))
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-4 text-center">
        <p
          className={cn(
            'font-mono text-[40px] font-semibold leading-none tracking-tight',
            finished ? 'text-danger' : timer ? 'text-ink' : 'text-ink-subtle',
          )}
          aria-live="polite"
        >
          {formatDuration(Math.ceil(remainingMs / 1000))}
        </p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn('h-full rounded-full transition-all', finished ? 'bg-danger' : 'bg-accent-solid')}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[12px] text-ink-subtle">
          {finished
            ? t("Time's up!")
            : timer?.running
              ? t('Counting down for everyone in the room.')
              : timer
                ? t('Paused.')
                : t('Start a countdown everyone can see.')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="number"
          min={1}
          max={180}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
          aria-label={t('Minutes')}
          className="h-8 w-16 px-2 text-center text-[13px]"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={start}
          disabled={running && !finished}
          className={cn(running && !finished && 'pointer-events-none opacity-45')}
        >
          <AlarmClock className="h-3.5 w-3.5" />
          {t('Start')}
        </Button>
        {timer?.running && !finished ? (
          <Button variant="secondary" size="sm" onClick={pauseTimer}>
            {t('Pause')}
          </Button>
        ) : timer && !timer.running && timer.remainingMs > 0 ? (
          <Button variant="secondary" size="sm" onClick={resumeTimer}>
            {t('Resume')}
          </Button>
        ) : null}
        {timer ? (
          <Button variant="ghost" size="sm" onClick={resetTimer}>
            {t('Reset')}
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Label className="mb-0 text-[12px]">{t('Quick set')}</Label>
        <Segmented
          ariaLabel={t('Timer quick set')}
          value={TIMER_PRESETS.some((preset) => preset.value === minutes) ? minutes : ''}
          onChange={(value) => setMinutes(value)}
          options={TIMER_PRESETS}
          size="sm"
          className="ml-auto flex-1"
        />
      </div>
    </div>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  const t = useT()
  return (
    <h3 className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
      {icon}
      {t(title)}
    </h3>
  )
}

function ToolRow({
  icon,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  const t = useT()
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface-2 p-3 text-left transition-colors hover:border-line-strong hover:bg-surface-3"
    >
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted')}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-ink">{t(title)}</span>
        <span className="block truncate text-[12px] text-ink-subtle">{t(description)}</span>
      </span>
      {action ? <span className="shrink-0 text-[12.5px] font-medium text-accent">{t(action)}</span> : null}
    </button>
  )
}
