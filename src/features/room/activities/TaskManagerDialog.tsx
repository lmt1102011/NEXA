import { useState } from 'react'
import { Check, Lock, LockOpen, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { Avatar } from '@/components/ui/avatar'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRoomSessionStore } from '@/stores/roomSession'
import {
  deleteTask,
  setTaskAssignee,
  setTaskLocked,
} from '@/features/room/session/sessionController'
import type { ActivityTask, Participant } from '@/types'

export function TaskManagerDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useT()
  const participants = useRoomSessionStore((state) => state.participants)
  const tasks = useRoomSessionStore((state) => state.tasks)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected =
    participants.find((participant) => participant.id === selectedId) ?? participants[0] ?? null
  const selectedTasks = selected ? tasks.filter((task) => task.assigneeId === selected.id) : []

  function countFor(id: string) {
    return tasks.filter((task) => task.assigneeId === id).length
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{t('Task management')}</DialogTitle>
          <DialogDescription>{t('Assign and lock the work of everyone in the room.')}</DialogDescription>
        </DialogHeader>
        <DialogBody className="p-0">
          <div className="flex max-h-[64dvh] min-h-[340px] flex-col sm:flex-row">
            <div className="shrink-0 overflow-y-auto border-b border-line p-2 nx-scroll sm:w-60 sm:border-b-0 sm:border-r">
              {participants.map((participant) => {
                const count = countFor(participant.id)
                const active = selected?.id === participant.id
                return (
                  <button
                    key={participant.id}
                    type="button"
                    onClick={() => setSelectedId(participant.id)}
                    aria-pressed={active}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                      active ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface-2',
                    )}
                  >
                    <Avatar name={participant.name} color={participant.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                      {participant.isSelf ? t('{name} (You)', { name: participant.name }) : participant.name}
                    </span>
                    {count > 0 ? (
                      <span className="shrink-0 rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle">
                        {count}
                      </span>
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 nx-scroll">
              {selected ? (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
                    <Avatar name={selected.name} color={selected.avatarColor} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{selected.name}</p>
                      <p className="text-[12.5px] text-ink-subtle">
                        {selected.role === 'host' ? t('Host') : t('Guest')}
                      </p>
                    </div>
                  </div>

                  <p className="mb-2 mt-4 text-[12px] font-semibold uppercase tracking-wider text-ink-subtle">
                    {t('Assigned tasks')}
                  </p>
                  {selectedTasks.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-[13px] text-ink-subtle">
                      {t('No tasks assigned.')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {selectedTasks.map((task) => (
                        <TaskAdminRow key={task.id} task={task} participants={participants} />
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function TaskAdminRow({
  task,
  participants,
}: {
  task: ActivityTask
  participants: Participant[]
}) {
  const t = useT()
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border',
            task.done ? 'border-accent bg-accent-solid text-white' : 'border-line bg-surface-2',
          )}
          aria-hidden
        >
          {task.done ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
        <p className={cn('min-w-0 flex-1 text-[13.5px] leading-snug', task.done ? 'text-ink-subtle line-through' : 'text-ink')}>
          {task.title}
        </p>
        <button
          type="button"
          aria-label={task.locked ? t('Unlock task') : t('Lock task')}
          title={task.locked ? t('Unlock task') : t('Lock task')}
          onClick={() => setTaskLocked(task.id, !task.locked)}
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors',
            task.locked
              ? 'bg-warning-soft text-warning hover:brightness-95'
              : 'text-ink-subtle hover:bg-surface-3 hover:text-ink',
          )}
        >
          {task.locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          aria-label={t('Delete task')}
          disabled={task.locked}
          onClick={() => deleteTask(task.id)}
          className={cn(
            'grid h-6 w-6 shrink-0 place-items-center rounded-md transition-colors',
            task.locked ? 'cursor-not-allowed text-ink-subtle/40' : 'text-ink-subtle hover:bg-surface-3 hover:text-danger',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-2 pl-7">
        <select
          value={task.assigneeId ?? ''}
          onChange={(event) => setTaskAssignee(task.id, event.target.value || null)}
          aria-label={t('Assignee')}
          className="h-8 w-full max-w-[220px] rounded-lg border border-line bg-surface-2 px-2 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong focus:border-accent focus:outline-none"
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
    </div>
  )
}
