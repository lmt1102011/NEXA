import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, ClipboardCopy, Download, ExternalLink, FileText, Paperclip, Pencil, Pin, Reply, SendHorizontal, SmilePlus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useT } from '@/lib/i18n'
import { useCopy } from '@/hooks'
import { Avatar } from '@/components/ui/avatar'
import { IconSmile } from '@/components/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ReactionBar } from '@/components/ui/reaction-bar'
import { EmptyState } from '@/components/ui/empty-state'
import { useRoomSessionStore } from '@/stores/roomSession'
import {
  deleteChatMessage,
  editChatMessage,
  pinMessage,
  sendChatMessage,
  sendFileMessage,
  sendTyping,
  toggleReaction,
} from '@/features/room/session/sessionController'
import { REACTION_EMOJIS } from '@/lib/reactions'
import type { ChatMessage } from '@/types'

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const EMOJIS = [
  '😀','😄','😁','🤣','😂','🙂','😉','😊','😍','😘','😜','🤪','🤔','🤨','😐',
  '😴','😷','🤯','😎','🥳','😢','😭','😤','😡','🥺','😳','🙃','😇','🤗','🤭',
  '👍','👎','👏','🙌','🙏','💪','🤝','✌️','🤞','👋','🫶','❤️','🔥','✨','🎉',
  '💯','⚡','☕','🍕','🚀','💡','✅','❌','❓','❗','💤','🫡','🤷','👀','🧠','🎯',
]

/**
 * Renders message text with `@Name` tokens highlighted. Names are matched
 * literally (longest first) so multi-word display names work, and the reader's
 * own name is emphasised.
 */
function renderMentionText(text: string, names: string[], selfName: string) {
  const sorted = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length)
  if (sorted.length === 0 || !text.includes('@')) return text
  const pattern = new RegExp(`@(${sorted.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const nodes: ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index))
    const selfHit = selfName.length > 0 && match[1].toLowerCase() === selfName.toLowerCase()
    nodes.push(
      <span
        key={`${match.index}:${match[1]}`}
        className={cn(
          'rounded px-0.5 font-medium',
          selfHit ? 'bg-accent/20 text-accent' : 'text-accent',
        )}
      >
        {match[0]}
      </span>,
    )
    last = match.index + match[0].length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/**
 * Matches everything that looks like a web link. Trailing punctuation is left
 * out so "xem https://… nhé." keeps its period outside the link.
 */
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+[^\s<>"'`.,!?:;)\]]/giu

/** Trimmed-down form of a link for display: no scheme, no `www.`, capped length. */
function shortenUrl(url: string) {
  const trimmed = url.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  return trimmed.length > 52 ? `${trimmed.slice(0, 51)}…` : trimmed
}

/**
 * Renders message text: URLs become tappable links, everything else keeps the
 * `@Name` highlighting. Only http/https links are linked, so a pasted
 * `javascript:` URL stays inert text.
 */
function renderMessageText(text: string, names: string[], selfName: string) {
  const urls = text.match(URL_PATTERN)
  if (!urls) return renderMentionText(text, names, selfName)

  const nodes: ReactNode[] = []
  let cursor = 0
  for (const url of urls) {
    const index = text.indexOf(url, cursor)
    if (index < 0) continue
    if (index > cursor) {
      nodes.push(
        <span key={`text-${cursor}`}>
          {renderMentionText(text.slice(cursor, index), names, selfName)}
        </span>,
      )
    }
    nodes.push(
      <a
        key={`url-${index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-1 font-medium text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
      >
        {shortenUrl(url)}
        <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
      </a>,
    )
    cursor = index + url.length
  }
  if (cursor < text.length) {
    nodes.push(
      <span key="text-tail">{renderMentionText(text.slice(cursor), names, selfName)}</span>,
    )
  }
  return nodes
}

export function ChatPanel() {
  const messages = useRoomSessionStore((state) => state.messages)
  const room = useRoomSessionStore((state) => state.room)
  const unread = useRoomSessionStore((state) => state.unread)
  const markRead = useRoomSessionStore((state) => state.markRead)
  const self = useRoomSessionStore((state) => state.self)
  const pinnedMessage = useRoomSessionStore((state) => state.pinnedMessage)
  const typing = useRoomSessionStore((state) => state.typing)
  const t = useT()

  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [mention, setMention] = useState<{ query: string; start: number } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const scrollPinned = useRef(true)
  const typingTimer = useRef<number | null>(null)

  const chatEnabled = room?.settings.chat.enabled ?? true
  const allowFiles = room?.settings.chat.allowFiles ?? true

  const participants = useRoomSessionStore((state) => state.participants)
  const mentionCandidates = useMemo(() => {
    if (!mention) return []
    const query = mention.query
    return participants
      .filter((participant) => participant.id !== self?.id)
      .filter((participant) => participant.name.toLowerCase().includes(query))
      .slice(0, 6)
  }, [mention, participants, self?.id])

  function applyMention(name: string) {
    if (!mention) return
    const next = draft.slice(0, mention.start) + '@' + name + ' '
    setDraft(next)
    setMention(null)
    setMentionIndex(0)
    sendTyping(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }


  const typingNames = Object.values(typing).map((entry) => entry.name)
  const visibleMessages = useMemo(() => messages, [messages])

  useEffect(() => {
    markRead()
  }, [markRead])

  useEffect(() => {
    return () => {
      if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
      sendTyping(false)
    }
  }, [])

  function handleDraftChange(value: string) {
    setDraft(value)
    sendTyping(value.trim().length > 0)
    if (typingTimer.current !== null) window.clearTimeout(typingTimer.current)
    typingTimer.current = window.setTimeout(() => sendTyping(false), 2500)
    const active = /(?:^|\s)@([\p{L}\p{N}._'-]*)$/u.exec(value)
    setMention(active ? { query: active[1].toLowerCase(), start: value.length - active[1].length - 1 } : null)
    setMentionIndex(0)
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    const start = el?.selectionStart ?? draft.length
    const end = el?.selectionEnd ?? draft.length
    const next = draft.slice(0, start) + emoji + draft.slice(end)
    setDraft(next)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    })
  }

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
    const trimmed = draft.trim()
    if (!trimmed) return
    sendChatMessage(trimmed, replyTo ?? undefined)
    setDraft('')
    setReplyTo(null)
    setMention(null)
    sendTyping(false)
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
        {visibleMessages.length === 0 ? (
          <EmptyState
            icon={<SendHorizontal className="h-5 w-5" />}
            title={t('No messages yet')}
            description={t('Say hi — messages are visible to everyone in the room.')}
            className="py-10"
          />
        ) : (
          visibleMessages.map((message) => <ChatRow key={message.id} message={message} onReply={setReplyTo} />)
        )}
      </div>

      {typingNames.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1.5 px-3 py-1 text-[11.5px] text-ink-subtle">
          <span className="flex items-end gap-[2px]" aria-hidden>
            {[0, 1, 2].map((index) => (
              <motion.span
                key={index}
                className="h-1 w-1 rounded-full bg-ink-subtle"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: index * 0.2 }}
              />
            ))}
          </span>
          {typingNames.length === 1
            ? t('{name} is typing…', { name: typingNames[0] })
            : t('{count} people are typing…', { count: typingNames.length })}
        </div>
      ) : null}

      {unread > 0 ? (
        <div className="relative">
          <div className="absolute -top-9 left-1/2 -translate-x-1/2 rounded-full bg-accent-solid px-3 py-1 text-[11.5px] font-medium text-white shadow-md">
            {t('{count} new messages', { count: unread })}
          </div>
        </div>
      ) : null}

      {replyTo ? (
        <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface-2 px-3 py-1.5">
          <Reply className="h-3.5 w-3.5 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate text-[12px]">
            <span className="font-medium text-ink-muted">
              {t('Replying to {name}', { name: replyTo.senderId === self?.id ? t('yourself') : replyTo.senderName })}
            </span>{' '}
            <span className="text-ink-subtle">
              {replyTo.kind === 'file' && replyTo.file ? replyTo.file.name : replyTo.text}
            </span>
          </p>
          <button
            type="button"
            aria-label={t('Cancel reply')}
            onClick={() => setReplyTo(null)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <div className="shrink-0 border-t border-line p-2.5">
        {mention && mentionCandidates.length > 0 ? (
          <div className="mb-1.5 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-lg">
            {mentionCandidates.map((participant, index) => (
              <button
                key={participant.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault()
                  applyMention(participant.name)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  index === mentionIndex ? 'bg-accent-soft text-ink' : 'text-ink-muted hover:bg-surface-3',
                )}
              >
                <Avatar name={participant.name} color={participant.avatarColor} size="sm" />
                <span className="truncate">{participant.name}</span>
              </button>
            ))}
          </div>
        ) : null}
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

          <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t('Emoji')}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-3 hover:text-ink"
              >
                <SmilePlus className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[300px] rounded-xl p-2 shadow-xl">
              <div className="grid max-h-[240px] grid-cols-8 gap-0.5 overflow-y-auto">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insertEmoji(emoji)
                    }}
                    className="grid h-8 w-8 place-items-center rounded-md text-[18px] transition-colors hover:bg-surface-3"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => handleDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (mention && mentionCandidates.length > 0) {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setMentionIndex((index) => (index + 1) % mentionCandidates.length)
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setMentionIndex((index) => (index - 1 + mentionCandidates.length) % mentionCandidates.length)
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  applyMention(mentionCandidates[mentionIndex].name)
                  return
                }
                if (event.key === 'Escape') {
                  setMention(null)
                  return
                }
              }
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

function ChatRow({ message, onReply }: { message: ChatMessage; onReply?: (message: ChatMessage) => void }) {
  const self = useRoomSessionStore((state) => state.self)
  const pinnedMessage = useRoomSessionStore((state) => state.pinnedMessage)
  const settings = useRoomSessionStore((state) => state.room?.settings)
  const participants = useRoomSessionStore((state) => state.participants)
  const t = useT()
  const { copied, copy } = useCopy()
  const [actionsOpen, setActionsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')
  const editRef = useRef<HTMLTextAreaElement>(null)
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
  const canDelete = (own || self?.role === 'host' || Boolean(self?.permissions?.canModerate)) && !message.deleted
  const canEdit = own && message.kind === 'text' && !message.deleted
  const isPinned = pinnedMessage?.id === message.id
  const isDeleted = Boolean(message.deleted)
  const bubbleText = message.kind === 'file' && message.file ? message.file.name : message.text
  const mentionNames = participants.map((participant) => participant.name)

  function beginEdit() {
    setEditDraft(message.text)
    setEditing(true)
    setActionsOpen(false)
    requestAnimationFrame(() => {
      editRef.current?.focus()
      editRef.current?.setSelectionRange(message.text.length, message.text.length)
    })
  }

  function commitEdit() {
    editChatMessage(message.id, editDraft)
    setEditing(false)
  }

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
          {message.editedAt && !isDeleted ? (
            <span className="text-[10.5px] italic text-ink-subtle">{t('(edited)')}</span>
          ) : null}
        </div>

        <div
          onTouchStart={editing ? undefined : startPress}
          onTouchEnd={editing ? undefined : cancelPress}
          onTouchMove={editing ? undefined : cancelPress}
          onContextMenu={(event) => {
            if (editing) return
            event.preventDefault()
            cancelPress()
            setActionsOpen((open) => !open)
          }}
          className={cn(
            'mt-1 rounded-xl px-3 py-2 text-[13.5px] leading-relaxed',
            editing ? 'w-full' : 'select-none',
            own ? 'rounded-tr-sm bg-accent-soft text-ink' : 'rounded-tl-sm border border-line bg-surface-2 text-ink',
          )}
        >
          {editing ? (
            <div className="flex min-w-[220px] flex-col gap-1.5">
              <textarea
                ref={editRef}
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    commitEdit()
                  } else if (event.key === 'Escape') {
                    event.preventDefault()
                    setEditing(false)
                  }
                }}
                rows={2}
                className="max-h-40 min-h-9 w-full resize-none rounded-lg border border-line bg-surface px-2 py-1.5 text-[13.5px] text-ink focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-3"
                >
                  {t('Cancel')}
                </button>
                <button
                  type="button"
                  onClick={commitEdit}
                  disabled={!editDraft.trim()}
                  className="rounded-lg bg-accent-solid px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-accent-solid-hover disabled:opacity-50"
                >
                  {t('Save')}
                </button>
              </div>
            </div>
          ) : isDeleted ? (
            <span className="inline-flex items-center gap-1.5 italic text-ink-subtle">
              <Trash2 className="h-3.5 w-3.5" />
              {t('This message was deleted')}
            </span>
          ) : (
            <>
              {message.replyTo ? (
                <div className="mb-1.5 rounded-lg border-l-2 border-accent/60 bg-black/10 px-2 py-1">
                  <p className="text-[11px] font-medium text-accent">{message.replyTo.name}</p>
                  <p className="truncate text-[12px] text-ink-muted">{message.replyTo.text}</p>
                </div>
              ) : null}
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
                <span className="whitespace-pre-wrap break-words select-text">
                  {renderMessageText(message.text, mentionNames, self?.name ?? '')}
                </span>
              )}
            </>
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
            {onReply ? (
              <button
                type="button"
                onClick={() => {
                  onReply(message)
                  setActionsOpen(false)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <Reply className="h-3.5 w-3.5" />
                {t('Reply')}
              </button>
            ) : null}
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
            {canEdit ? (
              <button
                type="button"
                onClick={beginEdit}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-3"
              >
                <Pencil className="h-3.5 w-3.5" />
                {t('Edit')}
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => {
                  deleteChatMessage(message.id)
                  setActionsOpen(false)
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('Delete')}
              </button>
            ) : null}
          </motion.div>
        ) : null}

        <div className={cn('mt-1 flex flex-wrap items-center gap-1.5', own && 'flex-row-reverse')}>
          {allowReactions && !isDeleted ? (
            <>
              {reactionEntries.map(([emoji, users]) => (
                <motion.button
                  key={emoji}
                  type="button"
                  onClick={() => toggleReaction(message.id, emoji)}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 22 }}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors',
                    mineActive(emoji)
                      ? 'border-accent/50 bg-accent-soft text-accent'
                      : 'border-line bg-surface-2 text-ink-muted hover:border-line-strong',
                  )}
                >
                  <span className="text-[14px] leading-none">{emoji}</span>
                  <span className="font-mono">{users.length}</span>
                </motion.button>
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
                <PopoverContent align={own ? 'end' : 'start'} className="w-auto rounded-full px-2 py-1.5 shadow-xl">
                  <ReactionBar emojis={REACTION_EMOJIS} size="sm" onPick={(emoji) => toggleReaction(message.id, emoji)} />
                </PopoverContent>
              </Popover>
            </>
          ) : null}

          {canPin && !isDeleted ? (
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
