import { useEffect, useState } from 'react'
import {
  AlarmClock,
  BarChart3,
  Check,
  ClipboardList,
  ListTodo,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Label, Textarea } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { useRoomSessionStore } from '@/stores/roomSession'
import {
  addPoll,
  addTask,
  addTodo,
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
import { formatDuration } from '@/lib/utils'
import type { ActivityTask } from '@/types'

type CreateKind = 'poll' | 'task' | 'todo' | 'timer'

const CREATE_OPTIONS: { kind: CreateKind; icon: typeof BarChart3; labelKey: string }[] = [
  { kind: 'poll', icon: BarChart3, labelKey: 'New poll' },
  { kind: 'task', icon: ClipboardList, labelKey: 'New task' },
  { kind: 'todo', icon: ListTodo, labelKey: 'New to-do' },
  { kind: 'timer', icon: AlarmClock, labelKey: 'New timer' },
]

export function ActivitiesPanel() {
  const t = useT()
  const markActivitiesRead = useRoomSessionStore((state) => state.markActivitiesRead)
  const pollCount = useRoomSessionStore((state) => state.polls.length)
  const taskCount = useRoomSessionStore((state) => state.tasks.length)
  const todoCount = useRoomSessionStore((state) => state.todos.length)
  const [createKind, setCreateKind] = useState<CreateKind | null>(null)

  useEffect(() => {
    markActivitiesRead()
  }, [markActivitiesRead])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-ink-subtle">
          <Sparkles className="h-3.5 w-3.5" />
          {t('Activities')}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="primary" className="ml-auto h-8 pl-2 pr-2.5">
              <Plus className="h-4 w-4" />
              <span className="hidden xl:inline">{t('Add activity')}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="w-56 p-1.5">
            <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
              {t('Add activity')}
            </p>
            {CREATE_OPTIONS.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => setCreateKind(option.kind)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">
                  <option.icon className="h-4 w-4" />
                </span>
                {t(option.labelKey)}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto nx-scroll px-3 pb-4 pt-3">
        <TimerSection />
        <Section
          title={t('Polls')}
          icon={<BarChart3 className="h-4 w-4 text-accent" />}
          count={pollCount}
          empty={{
            title: t('No polls yet'),
            description: t('Start a quick vote — everyone can vote live.'),
            onCreate: () => setCreateKind('poll'),
            createLabel: t('New poll'),
          }}
        >
          <PollsList />
        </Section>
        <Section
          title={t('Tasks')}
          icon={<ClipboardList className="h-4 w-4 text-accent" />}
          count={taskCount}
          empty={{
            title: t('No tasks yet'),
            description: t('Assign work to someone and track it live.'),
            onCreate: () => setCreateKind('task'),
            createLabel: t('New task'),
          }}
        >
          <TasksList />
        </Section>
        <Section
          title={t('Todo list')}
          icon={<ListTodo className="h-4 w-4 text-accent" />}
          count={todoCount}
          empty={{
            title: t('Nothing on the list'),
            description: t('A shared checklist for everyone in the room.'),
            onCreate: () => setCreateKind('todo'),
            createLabel: t('New to-do'),
          }}
        >
          <TodosList />
        </Section>
        <p className="flex items-center gap-1 text-[12px] text-ink-subtle">
          <UserPlus className="h-3 w-3" />
          {t('Activities are shared live with everyone in the room.')}
        </p>
      </div>

      {createKind ? (
        <CreateDialog key={createKind} kind={createKind} onClose={() => setCreateKind(null)} />
      ) : null}
    </div>
  )
}

function Section({ title, icon, count, empty, children }: {
  title: string
  icon: React.ReactNode
  count: number
  empty: { title: string; description: string; onCreate: () => void; createLabel: string }
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        {icon}
        <h2 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle">{count}</span>
      </div>
      <div className="space-y-2">
        {count === 0 ? (
          <EmptyState
            icon={icon}
            title={empty.title}
            description={empty.description}
            className="py-5"
            action={
              <Button size="sm" onClick={empty.onCreate}>
                <Plus className="h-3.5 w-3.5" />
                {empty.createLabel}
              </Button>
            }
          />
        ) : (
          children
        )}
      </div>
    </section>
  )
}

function useActivityPermissions() {
  const self = useRoomSessionStore((state) => state.self)
  return {
    canEdit: (createdBy: string) =>
      Boolean(self && (self.role === 'host' || self.permissions?.canModerate || self.id === createdBy)),
  }
}

function PollsList() {
  const polls = useRoomSessionStore((state) => state.polls)
  const self = useRoomSessionStore((state) => state.self)
  const { canEdit } = useActivityPermissions()
  const t = useT()

  if (polls.length === 0) return null
  return (
    <>
      {[...polls].reverse().map((poll) => {
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
      })}
    </>
  )
}

function TasksList() {
  const tasks = useRoomSessionStore((state) => state.tasks)
  if (tasks.length === 0) return null
  return (
    <>
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </>
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
  const mine = Boolean(self && task.assigneeId === self.id)

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-surface p-3',
        mine ? 'border-accent/50 bg-accent-soft/25' : 'border-line',
      )}
    >
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
            {mine ? (
              <Badge variant="accent" className="text-[11px]">
                <Check className="h-3 w-3" />
                {t('Yours')}
              </Badge>
            ) : null}
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

function TodosList() {
  const todos = useRoomSessionStore((state) => state.todos)
  const { canEdit } = useActivityPermissions()
  const t = useT()

  if (todos.length === 0) return null
  const doneCount = todos.filter((todo) => todo.done).length

  return (
    <>
      <p className="text-[11.5px] text-ink-subtle">
        {t('{done}/{total} done', { done: doneCount, total: todos.length })}
      </p>
      <div className="space-y-1.5">
        {todos.map((todo) => (
          <div key={todo.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2">
            <button
              type="button"
              aria-label={todo.done ? t('Mark as not done') : t('Mark as done')}
              onClick={() => toggleTodo(todo.id)}
              className={cn(
                'grid shrink-0 place-items-center rounded-md border transition-colors',
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
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </>
  )
}

const TIMER_QUICK = [300_000, 600_000, 1_500_000]

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
    <section>
      <div className="mb-2 flex items-center gap-1.5">
        <AlarmClock className="h-4 w-4 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink">{t('Timer')}</h2>
        {timer ? (
          <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle">
            {finished ? t("Time's up!") : t('Active')}
          </span>
        ) : null}
      </div>

      <div className="rounded-xl border border-line bg-surface p-3">
        {timer ? (
          <>
            <p
              className={cn(
                'text-center font-mono text-[32px] font-semibold leading-none tracking-tight',
                finished ? 'text-danger' : 'text-ink',
              )}
              aria-live="polite"
            >
              {formatDuration(Math.ceil(remainingMs / 1000))}
            </p>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={cn('h-full rounded-full transition-all', finished ? 'bg-danger' : 'bg-accent-solid')}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-center text-[12px] text-ink-subtle">
              {finished
                ? t("Time's up!")
                : timer.running
                  ? t('Counting down for everyone in the room.')
                  : t('Paused.')}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              {timer.running && !finished ? (
                <Button variant="secondary" size="sm" onClick={pauseTimer}>
                  {t('Pause')}
                </Button>
              ) : timer.remainingMs > 0 ? (
                <Button variant="secondary" size="sm" onClick={resumeTimer}>
                  {t('Resume')}
                </Button>
              ) : null}
              <Button variant="ghost" size="sm" onClick={resetTimer}>
                {t('Reset')}
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <Input
                type="number"
                min={1}
                max={180}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
                aria-label={t('Minutes')}
                className="h-8 w-16 px-2 text-center text-[13px]"
              />
              <Button variant="primary" size="sm" onClick={start} disabled={!Number.isFinite(Number(minutes)) || Number(minutes) <= 0}>
                <AlarmClock className="h-3.5 w-3.5" />
                {t('Start')}
              </Button>
            </div>
            <div className="flex items-center justify-center gap-1.5">
              {TIMER_QUICK.map((ms) => (
                <button
                  key={ms}
                  type="button"
                  onClick={() => startTimer(ms)}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 font-mono text-[12px] font-semibold text-ink transition-colors hover:border-line-strong"
                >
                  +{formatDuration(ms / 1000)}
                </button>
              ))}
            </div>
            <p className="text-center text-[12px] text-ink-subtle">{t('Start a countdown everyone can see.')}</p>
          </div>
        )}
      </div>
    </section>
  )
}

function DialogShell({ titleKey, icon, onClose, children, footer }: {
  titleKey: string
  icon: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  const t = useT()
  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>
              {t(titleKey)}
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t(titleKey)}</DialogDescription>
        </DialogHeader>
        <DialogBody>{children}</DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              {t('Cancel')}
            </Button>
          </DialogClose>
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateDialog({ kind, onClose }: { kind: CreateKind; onClose: () => void }) {
  if (kind === 'poll') return <CreatePollDialog onClose={onClose} />
  if (kind === 'task') return <CreateTaskDialog onClose={onClose} />
  if (kind === 'todo') return <CreateTodoDialog onClose={onClose} />
  return <CreateTimerDialog onClose={onClose} />
}

function CreatePollDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const canSubmit = question.trim().length > 0 && options.filter((option) => option.trim()).length >= 2
  const hasMoreThanTwo = options.length > 2

  return (
    <DialogShell
      titleKey="New poll"
      icon={<BarChart3 className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="sm"
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit) return
            addPoll(question, options)
            onClose()
          }}
        >
          {t('Add poll')}
        </Button>
      }
    >
      <div className="space-y-2">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && canSubmit) {
              addPoll(question, options)
              onClose()
            }
          }}
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
            {hasMoreThanTwo ? (
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
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setOptions([...options, ''])}
          disabled={options.length >= 6}
        >
          <Plus className="h-3.5 w-3.5" />
          {t('Option')}
        </Button>
      </div>
    </DialogShell>
  )
}

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const participants = useRoomSessionStore((state) => state.participants)
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')

  return (
    <DialogShell
      titleKey="New task"
      icon={<ClipboardList className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="sm"
          disabled={!title.trim()}
          onClick={() => {
            if (!title.trim()) return
            addTask(title, assigneeId || null)
            onClose()
          }}
        >
          {t('Add task')}
        </Button>
      }
    >
      <div className="space-y-2">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && title.trim()) {
              addTask(title, assigneeId || null)
              onClose()
            }
          }}
          placeholder={t('What needs to get done?')}
          aria-label={t('Task title')}
          className="h-9 text-[13px]"
        />
        <select
          value={assigneeId}
          onChange={(event) => setAssigneeId(event.target.value)}
          aria-label={t('Assign to')}
          className="h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
        >
          <option value="">{t('No assignee')}</option>
          {participants.map((participant) => (
            <option key={participant.id} value={participant.id}>
              {participant.name}
              {participant.isSelf ? ` ${t('(You)')}` : ''}
            </option>
          ))}
        </select>
      </div>
    </DialogShell>
  )
}

function CreateTodoDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')

  return (
    <DialogShell
      titleKey="New to-do"
      icon={<ListTodo className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="sm"
          disabled={!text.trim()}
          onClick={() => {
            if (!text.trim()) return
            addTodo(text)
            onClose()
          }}
        >
          {t('Add')}
        </Button>
      }
    >
      <Input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && text.trim()) {
            addTodo(text)
            onClose()
          }
        }}
        placeholder={t('Add an item to the shared list…')}
        aria-label={t('To-do item')}
        className="h-9 text-[13px]"
      />
    </DialogShell>
  )
}

const TIMER_PRESETS = [
  { value: '1', label: '1m' },
  { value: '5', label: '5m' },
  { value: '10', label: '10m' },
  { value: '25', label: '25m' },
]

function CreateTimerDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [minutes, setMinutes] = useState('5')
  const value = Number.parseFloat(minutes)
  const valid = Number.isFinite(value) && value > 0

  return (
    <DialogShell
      titleKey="New timer"
      icon={<AlarmClock className="h-4 w-4" />}
      onClose={onClose}
      footer={
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() => {
            if (!valid) return
            startTimer(Math.round(value * 60_000))
            onClose()
          }}
        >
          <AlarmClock className="h-3.5 w-3.5" />
          {t('Start')}
        </Button>
      }
    >
      <div className="space-y-3">
        <p className="flex items-center justify-center gap-2">
          <Input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            aria-label={t('Minutes')}
            className="h-9 w-20 px-2 text-center text-[13px]"
          />
          <Label className="mb-0 text-[13px] text-ink-subtle">{t('Minutes')}</Label>
        </p>
        <Segmented
          ariaLabel={t('Timer quick set')}
          value={TIMER_PRESETS.some((preset) => preset.value === minutes) ? minutes : ''}
          onChange={setMinutes}
          options={TIMER_PRESETS}
          size="sm"
          className="w-full"
        />
      </div>
    </DialogShell>
  )
}