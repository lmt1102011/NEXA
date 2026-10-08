import type { ChatFile, ChatMessage, ID } from '@/types'
import { generateId } from '@/lib/utils'

export function buildTextMessage(input: {
  roomId: ID
  senderId: ID
  senderName: string
  avatarColor: string
  text: string
}): ChatMessage {
  return {
    id: generateId('msg'),
    roomId: input.roomId,
    senderId: input.senderId,
    senderName: input.senderName,
    avatarColor: input.avatarColor,
    kind: 'text',
    text: input.text.trim().slice(0, 2000),
    reactions: {},
    createdAt: Date.now(),
  }
}

export function buildSystemMessage(roomId: ID, text: string): ChatMessage {
  return {
    id: generateId('msg'),
    roomId,
    senderId: 'system',
    senderName: 'System',
    avatarColor: '#717689',
    kind: 'system',
    text,
    reactions: {},
    createdAt: Date.now(),
  }
}

export function buildFileMessage(input: {
  roomId: ID
  senderId: ID
  senderName: string
  avatarColor: string
  file: ChatFile
}): ChatMessage {
  return {
    id: generateId('msg'),
    roomId: input.roomId,
    senderId: input.senderId,
    senderName: input.senderName,
    avatarColor: input.avatarColor,
    kind: 'file',
    text: '',
    file: input.file,
    reactions: {},
    createdAt: Date.now(),
  }
}
