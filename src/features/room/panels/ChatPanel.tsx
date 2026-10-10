import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, ClipboardCopy, Download, FileText, Paperclip, Pin, SendHorizontal, SmilePlus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useCopy } from '@/hooks'
import { Avatar } from '@/components/ui/avatar'
import { IconSmile } from '@/components/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { EmptyState } from '@/components/ui/empty-state'
import { useRoomSessionStore } from '@/stores/roomSession'
import {
  pinMessage,
  sendChatMessage,
  sendFileMessage,
  toggleReaction,
} from '@/features/room/session/sessionController'
import type { ChatMessage } from '@/types'

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🔥']

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ChatPanel() {
  const messages = useRoomSessionStore((state) => state.messages)
  const room = useRoomSessionStore((state) => state.room)
  const unread = useRoomSessionStore((state) => state.unread)
  const markRead = useRoomSessionStore((state) => state.markRead)
  const self = useRoomSessionStore((state) => state.self)
  const pinnedMessage = useRoomSessionStore((state) => state.pinnedMessage)
  const t = useT()

  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollPinned = useRef(true)

  const chatEnabled = room?.settings.chat.enabled ?? true
  const allowFiles = room?.settings.chat.allowFiles ?? true

  useEffect(() => {
    markRead()
  }, [markRead])

  useEffect(() => {
    const list = listRef.current
    if (!list || !scrollPinned.current) return
    list.scrollTop = list.scrollHeight
  }, [messages.length])

  function handleScroll() {
    const list = listRef.current
    if (!list) return
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight
    scrollPinned.current = distance < 80
  }

  function submit() {
    const text = draft.trim()
    if (!text) return
    sendChatMessage(text)
    setDraft('')
    scrollPinned.current = true
  }

  if (!chatEnabled) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={<SmilePlus className="h-5 w-5" />}
          title={t('Chat is turned off')}
          description={t('The host disabled chat for this room.')}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {pinnedMessage ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-accent-soft/60 px-3 py-2">
          <Pin className="h-3.5 w-3.5 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
            <span className="font-medium">
              {pinnedMessage.senderId === self?.id ? t('You') : pinnedMessage.senderName}:
            </span>{' '}
            {pinnedMessage.kind === 'file' && pinnedMessage.file ? pinnedMessage.file.name : pinnedMessage.text}
          </p>
          {self?.role === 'host' ||
          Boolean(self?.permissions?.canModerate) ||
          pinnedMessage.senderId === self?.id ? (
            <button
              type="button"
              aria-label={t('Unpin message')}
              onClick={() => pinMessage(null)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}

      <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto nx-scroll px-3 py-3.5">
        {messages.length === 0 ? (
          <EmptyState
            icon={<SendHorizontal className="h-5 w-5" />}
            title={t('No messages yet')}
            description={t('Say hi — messages are visible to everyone in the room.')}
            className="py-10"
          />
        ) : (
          messages.map((message) => <ChatRow key={message.id} message={message} />)
        )}
      </div>

      {unread > 0 ? (
        <div className="relative">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-accent-solid px-3 py-1 text-[11.5px] font-medium text-white shadow-md">
            {t('{count} new messages', { count: unread })}
          </div>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-line p-2.5">
        <div className="flex items-end gap-1.5 rounded-xl border border-line bg-surface-2 p-1.5 transition-[border-color,box-shadow] focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20">
          {allowFiles ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) sendFileMessage(file)
                  event.target.value = ''
                }}
              />
              <button
                type="button"
                aria-label={t('Attach file')}
                onClick={() => fileRef.current?.click()}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <Paperclip className="h-4 w-4" />
              </button>
            </>
          ) : null}

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={t('Send a message…')}
            aria-label={t('Message')}
            className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-1.5 py-2 text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
          />

          <button
            type="button"
            aria-label={t('Send message')}
            disabled={!draft.trim()}
            onClick={submit}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-solid text-white transition-colors hover:bg-accent-solid-hover disabled:pointer-events-none disabled:opacity-40"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function ChatRow({ message }: { message: ChatMessage }) {
  const self = useRoomSessionStore((state) => state.self)
  const pinnedMessage = useRoomSessionStore((state) => state.pinnedMessage)
  const settings = useRoomSessionStore((state) => state.room?.settings)
  const t = useT()
  const { copied, copy } = useCopy()
  const [actionsOpen, setActionsOpen] = useState(false)
  const pressTimer = useRef<number | null>(null)

  function startPress() {
    if (pressTimer.current !== null) return
    pressTimer.current = window.setTimeout(() => setActionsOpen(true), 480)
  }

  function cancelPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  if (message.kind === 'system') {
    return (
      <div className="py-1 text-center text-[11.5px] text-ink-subtle">
        {message.text} · {formatTime(message.createdAt)}
      </div>
    )
  }

  const own = message.senderId === self?.id
  const allowReactions = Boolean(settings?.chat.enabled && settings.chat.allowReactions)
  const reactionEntries = Object.entries(message.reactions)
  const mineActive = (emoji: string) => (message.reactions[emoji] ?? []).includes(self?.id ?? '')
  const canPin = own || self?.role === 'host' || Boolean(self?.permissions?.canModerate)
  const isPinned = pinnedMessage?.id === message.id
  const bubbleText = message.kind === 'file' && message.file ? message.file.name : message.text

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn('group flex gap-2.5', own && 'flex-row-reverse')}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        cancelPress()
        setActionsOpen(false)
      }}
    >
      <Avatar name={message.senderName} color={message.avatarColor} size="sm" className="mt-0.5" />

      <div className={cn('min-w-0 max-w-[80%]', own && 'flex flex-col items-end')}>
        <div className={cn('flex items-baseline gap-2', own && 'flex-row-reverse')}>
          <span className="text-[12px] font-medium text-ink-muted">{own ? t('You') : message.senderName}</span>
          <span className="font-mono text-[10.5px] text-ink-subtle">{formatTime(message.createdAt)}</span>
        </div>

        <div
          onTouchStart={startPress}
          onTouchEnd={cancelPress}
          onTouchMove={cancelPress}
          onContextMenu={(event) => {
            event.preventDefault()
            cancelPress()
            setActionsOpen((open) => !open)
          }}
          className={cn(
            'mt-1 rounded-xl px-3 py-2 text-[13.5px] leading-relaxed select-none',
            own ? 'rounded-tr-sm bg-accent-soft text-ink' : 'rounded-tl-sm border border-line bg-surface-2 text-ink',
          )}
        >
          {message.kind === 'file' && message.file ? (
            <a
              href={message.file.url}
              download={message.file.name}
              className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 transition-colors hover:border-line-strong"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                <FileText className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-ink">{message.file.name}</span>
                <span className="block font-mono text-[11px] text-ink-subtle">
                  {formatFileSize(message.file.size)}
                </span>
              </span>
              <Download className="ml-auto h-4 w-4 shrink-0 text-ink-subtle" />
            </a>
          ) : (
            <span className="whitespace-pre-wrap break-words select-text">{message.text}</span>
          )}
        </div>

        {actionsOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('mt-1.5 flex items-center gap-1 rounded-xl border border-line bg-surface p-1 shadow-md', own && 'flex-row-reverse')}
          >
            <button
              type="button"
              onClick={() => {
                void copy(bubbleText)
                setActionsOpen(false)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-3"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
              {copied ? t('Copied') : t('Copy')}
            </button>
            {canPin ? (
              <button
                type="button"
                onClick={() => {
                  pinMessage(isPinned ? null : message)
                  setActionsOpen(false)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <Pin className={cn('h-3.5 w-3.5', isPinned ? 'text-accent' : '')} />
                {isPinned ? t('Unpin') : t('Pin')}
              </button>
            ) : null}
          </motion.div>
        ) : null}

        <div className={cn('mt-1 flex flex-wrap items-center gap-1.5', own && 'flex-row-reverse')}>
          {allowReactions ? (
            <>
              {reactionEntries.map(([emoji, users]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => toggleReaction(message.id, emoji)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11.5px] transition-colors',
                    mineActive(emoji)
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong',
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-mono">{users.length}</span>
                </button>
              ))}

              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('Add reaction')}
                    className="grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-2 text-ink-subtle transition-opacity hover:text-ink focus:opacity-100 md:opacity-0 md:group-hover:opacity-100"
                  >
                    <IconSmile className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align={own ? 'end' : 'start'} className="flex gap-1 p-1.5">
                  {QUICK_EMOJI.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => toggleReaction(message.id, emoji)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-[16px] transition-colors hover:bg-surface-3"
                    >
                      {emoji}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </>
          ) : null}

          {canPin ? (
            <button
              type="button"
              aria-label={isPinned ? t('Unpin message') : t('Pin message')}
              onClick={() => pinMessage(isPinned ? null : message)}
              className={cn(
                'grid h-6 w-6 place-items-center rounded-full border border-line bg-surface-2 transition-colors hover:text-ink focus:opacity-100 md:opacity-0 md:group-hover:opacity-100',
                isPinned
                  ? 'border-accent/50 bg-accent-soft text-accent opacity-100'
                  : 'text-ink-subtle',
              )}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  )
}
