import { useEffect, useState } from 'react'
import {
  AlarmClock,
  BarChart3,
  Check,
  ClipboardList,
  ListTodo,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  setTaskNote,
  startTimer,
  toggleTask,
  toggleTodo,
  votePoll,
} from '@/features/room/session/sessionController'
import { formatDuration } from '@/lib/utils'
import type { ActivityTask, TodoItem } from '@/types'

type ActivityKind = 'timer' | 'poll' | 'task' | 'todo'

const KIND_ORDER: ActivityKind[] = ['timer', 'poll', 'task', 'todo']

const KIND_ICON: Record<ActivityKind, typeof BarChart3> = {
  timer: AlarmClock,
  poll: BarChart3,
  task: ClipboardList,
  todo: ListTodo,
}

const KIND_TITLE: Record<ActivityKind, string> = {
  timer: 'Timer',
  poll: 'Polls',
  task: 'Tasks',
  todo: 'Todo list',
}

const CREATE_OPTIONS: { kind: ActivityKind; labelKey: string }[] = [
  { kind: 'poll', labelKey: 'New poll' },
  { kind: 'task', labelKey: 'New task' },
  { kind: 'todo', labelKey: 'New to-do' },
  { kind: 'timer', labelKey: 'New timer' },
]

const triggerClass =
  'relative grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface-2 text-ink-muted transition-colors hover:border-line-strong hover:text-ink'

export function ActivityBar() {
  const t = useT()
  const self = useRoomSessionStore((state) => state.self)
  const pollCount = useRoomSessionStore((state) => state.polls.length)
  const taskCount = useRoomSessionStore((state) => state.tasks.length)
  const todos = useRoomSessionStore((state) => state.todos)
  const hasTimer = useRoomSessionStore((state) => Boolean(state.timer))
  const isModerator = Boolean(self && (self.role === 'host' || self.permissions?.canModerate))
  const todoCount = isModerator ? todos.length : todos.filter((todo) => todo.createdBy === self?.id).length
  const activitiesUnread = useRoomSessionStore((state) => state.activitiesUnread)
  const markActivitiesRead = useRoomSessionStore((state) => state.markActivitiesRead)
  const [openKind, setOpenKind] = useState<ActivityKind | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createKind, setCreateKind] = useState<ActivityKind | null>(null)

  useEffect(() => {
    if (openKind) markActivitiesRead()
  }, [openKind, markActivitiesRead])

  const counts: Record<ActivityKind, number> = {
    timer: hasTimer ? 1 : 0,
    poll: pollCount,
    task: taskCount,
    todo: todoCount,
  }
  const visibleKinds = KIND_ORDER.filter((kind) => counts[kind] > 0)

  function startCreate(kind: ActivityKind) {
    setOpenKind(null)
    setCreateOpen(false)
    setCreateKind(kind)
  }

  return (
    <>
      <Popover open={createOpen} onOpenChange={setCreateOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('Add activity')}
            title={t('Add activity')}
            className={cn(triggerClass, 'text-ink')}
          >
            <Plus className="h-4 w-4" />
            {activitiesUnread > 0 ? (
              <span
                className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-danger-solid ring-2 ring-surface"
                aria-hidden
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={6} className="w-56 p-1.5">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            {t('Add activity')}
          </p>
          {CREATE_OPTIONS.map((option) => {
            const Icon = KIND_ICON[option.kind]
            return (
              <button
                key={option.kind}
                type="button"
                onClick={() => startCreate(option.kind)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                {t(option.labelKey)}
              </button>
            )
          })}
        </PopoverContent>
      </Popover>

      {visibleKinds.map((kind) => {
        const Icon = KIND_ICON[kind]
        const count = counts[kind]
        return (
          <Popover
            key={kind}
            open={openKind === kind}
            onOpenChange={(open) => setOpenKind(open ? kind : null)}
          >
            <PopoverTrigger asChild>
              <button type="button" aria-label={t(KIND_TITLE[kind])} title={t(KIND_TITLE[kind])} className={triggerClass}>
                <Icon className="h-4 w-4" />
                {count > 1 ? (
                  <span className="absolute -right-1.5 -top-1.5 grid min-w-[16px] place-items-center rounded-full bg-accent-solid px-1 font-mono text-[9px] font-semibold leading-4 text-white">
                    {count > 9 ? '9+' : count}
                  </span>
                ) : (
                  <span
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent-solid"
                    aria-hidden
                  />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" sideOffset={6} className="w-[min(380px,calc(100vw-2rem))] p-0">
              <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <h3 className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{t(KIND_TITLE[kind])}</h3>
                <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle">{count}</span>
                {kind !== 'task' ? (
                  <Button size="sm" variant="secondary" className="h-7 px-2" onClick={() => startCreate(kind)}>
                    <Plus className="h-3.5 w-3.5" />
                    {t('New')}
                  </Button>
                ) : null}
              </div>
              <div className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto nx-scroll p-3">
                {kind === 'timer' ? <TimerCard /> : null}
                {kind === 'poll' ? <PollsList /> : null}
                {kind === 'task' ? <TasksList /> : null}
                {kind === 'todo' ? <TodosList /> : null}
              </div>
            </PopoverContent>
          </Popover>
        )
      })}

      {createKind ? <CreateDialog kind={createKind} onClose={() => setCreateKind(null)} /> : null}
    </>
  )
}

function activityNote(note?: string) {
  if (!note || !note.trim()) return null
  return <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-subtle">{note}</p>
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
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium text-ink">{poll.question}</p>
                {activityNote(poll.note)}
              </div>
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
  const self = useRoomSessionStore((state) => state.self)
  const { canEdit } = useActivityPermissions()
  const t = useT()
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState(task.note)
  const editable = canEdit(task.createdBy)
  const mine = Boolean(self && task.assigneeId === self.id)
  // Only the assignee ticks a task; unassigned tasks fall back to host/moderator/creator.
  const canToggle = task.assigneeId != null ? mine : editable

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
          disabled={!canToggle}
          aria-label={task.done ? t('Mark as not done') : t('Mark as done')}
          onClick={() => toggleTask(task.id)}
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
            task.done ? 'border-accent bg-accent-solid text-white' : 'border-line bg-surface-2 hover:border-line-strong',
            !canToggle && 'cursor-not-allowed opacity-50 hover:border-line',
          )}
        >
          {task.done ? <Check className="h-3.5 w-3.5" /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn('text-[13.5px] leading-snug', task.done ? 'text-ink-subtle line-through' : 'text-ink')}>
            {task.title}
          </p>
          {!noteOpen ? activityNote(task.note) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
          placeholder={t('Add a note…')}
          className="mt-2 min-h-[60px] text-[13px]"
        />
      ) : null}
    </div>
  )
}

function TodosList() {
  const todos = useRoomSessionStore((state) => state.todos)
  const self = useRoomSessionStore((state) => state.self)
  const participants = useRoomSessionStore((state) => state.participants)
  const t = useT()

  if (!self || todos.length === 0) return null
  const isModerator = self.role === 'host' || Boolean(self.permissions?.canModerate)
  const mine = todos.filter((todo) => todo.createdBy === self.id)

  // Everyone gets their own private list.
  if (!isModerator) {
    if (mine.length === 0) return null
    const doneCount = mine.filter((todo) => todo.done).length
    return (
      <>
        <p className="text-[11.5px] text-ink-subtle">
          {t('{done}/{total} done', { done: doneCount, total: mine.length })}
        </p>
        <div className="space-y-1.5">
          {mine.map((todo) => (
            <TodoRow key={todo.id} todo={todo} readOnly={false} />
          ))}
        </div>
      </>
    )
  }

  // Host/moderators get a read-only view of everyone's progress.
  const order: string[] = []
  const groups = new Map<string, TodoItem[]>()
  for (const todo of todos) {
    let list = groups.get(todo.createdBy)
    if (!list) {
      list = []
      groups.set(todo.createdBy, list)
      order.push(todo.createdBy)
    }
    list.push(todo)
  }
  order.sort((a, b) => (a === self.id ? -1 : b === self.id ? 1 : 0))

  return (
    <>
      {order.map((ownerId) => {
        const items = groups.get(ownerId) ?? []
        const doneCount = items.filter((todo) => todo.done).length
        const owner = participants.find((participant) => participant.id === ownerId)
        const label = ownerId === self.id ? t('You') : owner?.name ?? t('Unknown')
        return (
          <div key={ownerId} className="space-y-1.5">
            <p className="text-[11.5px] font-medium text-ink-subtle">
              {label} · {t('{done}/{total} done', { done: doneCount, total: items.length })}
            </p>
            {items.map((todo) => (
              <TodoRow key={todo.id} todo={todo} readOnly={ownerId !== self.id} />
            ))}
          </div>
        )
      })}
    </>
  )
}

function TodoRow({ todo, readOnly }: { todo: TodoItem; readOnly: boolean }) {
  const t = useT()
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2">
      <button
        type="button"
        disabled={readOnly}
        aria-label={todo.done ? t('Mark as not done') : t('Mark as done')}
        onClick={() => toggleTodo(todo.id)}
        className={cn(
          'mt-0.5 grid shrink-0 place-items-center rounded-md border transition-colors',
          todo.done ? 'border-accent bg-accent-solid text-white' : 'border-line bg-surface-2 hover:border-line-strong',
          readOnly && 'cursor-not-allowed opacity-60',
        )}
        style={{ height: 18, width: 18 }}
      >
        {todo.done ? <Check className="h-3 w-3" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <span className={cn('block text-[13px]', todo.done ? 'text-ink-subtle line-through' : 'text-ink')}>
          {todo.text}
        </span>
        {activityNote(todo.note)}
      </div>
      {!readOnly ? (
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
  )
}

function TimerCard() {
  const timer = useRoomSessionStore((state) => state.timer)
  const t = useT()
  const [, setTick] = useState(0)
  const running = Boolean(timer?.running)

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setTick((tick) => tick + 1), 300)
    return () => window.clearInterval(id)
  }, [running])

  if (!timer) return null

  const remainingMs = timer.running && timer.endsAt ? Math.max(0, timer.endsAt - Date.now()) : timer.remainingMs
  const finished = Boolean(timer.running) && remainingMs <= 0
  const totalMs = timer.remainingMs && timer.remainingMs > 0 ? timer.remainingMs : 1
  const progress = Math.max(0, Math.min(1, remainingMs / totalMs))

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
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
      {activityNote(timer.note)}
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
    </div>
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

function CreateDialog({ kind, onClose }: { kind: ActivityKind; onClose: () => void }) {
  if (kind === 'poll') return <CreatePollDialog onClose={onClose} />
  if (kind === 'task') return <CreateTaskDialog onClose={onClose} />
  if (kind === 'todo') return <CreateTodoDialog onClose={onClose} />
  return <CreateTimerDialog onClose={onClose} />
}

function CreatePollDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [note, setNote] = useState('')
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
            addPoll(question, options, note)
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
              addPoll(question, options, note)
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
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('Add a note…')}
          aria-label={t('Note')}
          className="min-h-[56px] text-[13px]"
        />
      </div>
    </DialogShell>
  )
}

function CreateTaskDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const participants = useRoomSessionStore((state) => state.participants)
  const [title, setTitle] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [note, setNote] = useState('')

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
            addTask(title, assigneeId || null, note)
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
              addTask(title, assigneeId || null, note)
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
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('Add a note…')}
          aria-label={t('Note')}
          className="min-h-[56px] text-[13px]"
        />
      </div>
    </DialogShell>
  )
}

function CreateTodoDialog({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [text, setText] = useState('')
  const [note, setNote] = useState('')

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
            addTodo(text, note)
            onClose()
          }}
        >
          {t('Add')}
        </Button>
      }
    >
      <div className="space-y-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && text.trim()) {
              addTodo(text, note)
              onClose()
            }
          }}
          placeholder={t('Add an item to the shared list…')}
          aria-label={t('To-do item')}
          className="h-9 text-[13px]"
        />
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('Add a note…')}
          aria-label={t('Note')}
          className="min-h-[56px] text-[13px]"
        />
      </div>
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
  const [note, setNote] = useState('')
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
            startTimer(Math.round(value * 60_000), note)
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
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('Add a note…')}
          aria-label={t('Note')}
          className="min-h-[56px] text-[13px]"
        />
      </div>
    </DialogShell>
  )
}
