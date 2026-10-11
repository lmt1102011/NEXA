/**
 * The quick reaction set used by the floating reaction picker and by the chat
 * "add reaction" bar. Kept in one place so both stay in sync.
 */
export const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🎉', '👏'] as const

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number]
