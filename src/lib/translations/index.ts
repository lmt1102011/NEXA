import { registerTranslations, type TranslationEntry } from '@/lib/i18n'
import { lobbyVi } from './vi-lobby'
import { roomVi } from './vi-room'
import { roomUiVi } from './vi-room-ui'
import { screensVi } from './vi-screens'
import { commonVi } from './vi-common'

const merged: Record<string, TranslationEntry> = {
  ...lobbyVi,
  ...roomVi,
  ...roomUiVi,
  ...screensVi,
  ...commonVi,
}

registerTranslations(merged)
