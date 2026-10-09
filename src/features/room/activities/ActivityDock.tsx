import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlarmClock,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Clapperboard,
  ListTodo,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { formatDuration } from '@/lib/utils'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore, type ActivitiesTab } from '@/stores/ui'
import { startTimer, votePoll } from '@/features/room/session/sessionController'
import type { Poll } from '@/types'

const TIMER_QUICK = [300_000, 600_000, 1_500_000]

export function ActivityDock() {
  const t = useT()
  const [expanded, setExpanded] = useState(false)
  const [creating, setCreating] = useState(false)
  const setActivitiesTab = useUiStore((state) => state.setActivitiesTab)

  const polls = useRoomSessionStore((state) => state.polls)
  const tasks = useRoomSessionStore((state) => state.tasks)
  const todos = useRoomSessionStore((state) => state.todos)
  const timer = useRoomSessionStore((state) => state.timer)

  const openPoll =
    [...polls].reverse().find((poll) => !poll.closed) ?? (polls.length > 0 ? polls[polls.length - 1] : null)

  const hasActivity = polls.length + tasks.length + todos.length + (timer ? 1 : 0) > 0

  function openTab(tab: ActivitiesTab) {
    setExpanded(false)
    setCreating(false)
    setActivitiesTab(tab)
  }

  const chipClass =
    'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3 text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface'

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-2 sm:bottom-3">
      <div className="pointer-events-auto relative flex max-w-full">
        <AnimatePresence mode="wait">
          {creating ? (
            <motion.div
              key="drawer"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-14 left-1/2 w-[min(340px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-line bg-surface/95 p-2 shadow-xl backdrop-blur"
            >
              <div className="flex items-center justify-between px-2 py-1">
                <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                  <Clapperboard className="h-3.5 w-3.5 text-accent" />
                  {t('Add an activity')}
                </p>
                <button
                  type="button"
                  aria-label={t('Close')}
                  onClick={() => setCreating(false)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <CreateButton icon={<BarChart3 className="h-4 w-4" />} label={t('Poll')} onClick={() => openTab('polls')} />
                <CreateButton icon={<ClipboardList className="h-4 w-4" />} label={t('Task')} onClick={() => openTab('tasks')} />
                <CreateButton icon={<ListTodo className="h-4 w-4" />} label={t('To-do')} onClick={() => openTab('todos')} />
                <CreateButton icon={<AlarmClock className="h-4 w-4" />} label={t('Timer')} onClick={() => openTab('timer')} />
              </div>
            </motion.div>
          ) : expanded ? (
            <motion.div
              key="dock"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.18 }}
              className="flex max-w-[calc(100vw-1rem)] items-center gap-1.5 overflow-x-auto nx-scroll rounded-2xl border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur"
            >
              {timer ? (
                <TimerChip />
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  {TIMER_QUICK.map((ms) => (
                    <button key={ms} type="button" onClick={() => startTimer(ms)} className={chipClass}>
                      <AlarmClock className="h-4 w-4 text-accent" />
                      +{formatDuration(ms / 1000)}
                    </button>
                  ))}
                </div>
              )}
              {openPoll ? <PollChip poll={openPoll} extraPolls={polls.filter((poll) => poll.id !== openPoll.id && !poll.closed).length} /> : null}
              {tasks.length > 0 ? (
                <button type="button" onClick={() => openTab('tasks')} className={chipClass}>
                  <ClipboardList className="h-4 w-4 text-accent" />
                  {t('{count} tasks', { count: tasks.length })}
                </button>
              ) : null}
              {todos.length > 0 ? (
                <button type="button" onClick={() => openTab('todos')} className={chipClass}>
                  <ListTodo className="h-4 w-4 text-accent" />
                  {t('{count} to-dos', { count: todos.length })}
                </button>
              ) : null}
              <button type="button" onClick={() => setCreating(true)} className={chipClass}>
                <Plus className="h-4 w-4 text-accent" />
                {t('Add')}
              </button>
              <button
                type="button"
                aria-label={t('Collapse activities')}
                onClick={() => setExpanded(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-ink-subtle transition-colors hover:text-ink"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </motion.div>
          ) : (
            <motion.button
              key="chip"
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={() => setExpanded(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface/90 px-3.5 text-[12.5px] font-medium text-ink shadow-lg backdrop-blur transition-colors hover:border-line-strong hover:bg-surface"
            >
              <Clapperboard className={cn('h-4 w-4', hasActivity ? 'text-accent' : 'text-ink-subtle')} />
              {hasActivity
                ? t('Activities · {count}', { count: polls.length + tasks.length + todos.length + (timer ? 1 : 0) })
                : t('Activities')}
              <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-ink-subtle" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function CreateButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-left text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-3"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-accent">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  )
}

function TimerChip() {
  const [, setTick] = useState(0)
  const timer = useRoomSessionStore((state) => state.timer)
  const setActivitiesTab = useUiStore((state) => state.setActivitiesTab)
  const running = Boolean(timer?.running)

  useEffect(() => {
    if (!running || !timer?.endsAt) return
    const id = window.setInterval(() => setTick((tick) => tick + 1), 500)
    return () => window.clearInterval(id)
  }, [running, timer?.endsAt])

  const remainingMs = timer
    ? timer.running && timer.endsAt
      ? Math.max(0, timer.endsAt - Date.now())
      : timer.remainingMs
    : 0
  const finished = running && remainingMs <= 0

  return (
    <button
      type="button"
      onClick={() => setActivitiesTab('timer')}
      className={cn(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 font-mono text-[12.5px] font-semibold backdrop-blur transition-colors',
        finished
          ? 'animate-pulse border-danger/50 bg-danger-soft text-danger'
          : 'border-line bg-surface/90 text-ink hover:border-line-strong',
      )}
    >
      {finished ? <AlarmClock className="h-4 w-4" /> : null}
      {formatDuration(Math.ceil(remainingMs / 1000))}
    </button>
  )
}

function PollChip({ poll, extraPolls }: { poll: Poll; extraPolls: number }) {
  const t = useT()
  const self = useRoomSessionStore((state) => state.self)
  const setActivitiesTab = useUiStore((state) => state.setActivitiesTab)
  const mines = (optionId: string) =>
    Boolean(self && poll.options.find((option) => option.id === optionId)?.votes.includes(self.id))

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-full border border-accent/40 bg-accent-soft/60 py-1 pl-3 pr-1.5 backdrop-blur">
      <span className="max-w-[150px] truncate text-[12.5px] font-semibold text-ink">
        {poll.closed ? `${t('Poll ended')} ·` : ''} {poll.question}
      </span>
      {poll.closed ? (
        <button
          type="button"
          onClick={() => setActivitiesTab('polls')}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-surface px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          {t('Results')}
        </button>
      ) : (
        <>
          {poll.options.slice(0, 3).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => votePoll(poll.id, option.id)}
              aria-label={t('Vote {option}', { option: option.text })}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors',
                mines(option.id)
                  ? 'border-accent bg-accent-solid text-white'
                  : 'border-line bg-surface text-ink hover:border-line-strong',
              )}
            >
              {mines(option.id) ? <Check className="h-3.5 w-3.5" /> : null}
              <span className="max-w-[90px] truncate">{option.text}</span>
            </button>
          ))}
          {extraPolls > 0 ? (
            <button
              type="button"
              onClick={() => setActivitiesTab('polls')}
              className="inline-flex h-8 items-center rounded-full bg-surface-2 px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              +{extraPolls}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}