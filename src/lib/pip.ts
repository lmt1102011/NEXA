/**
 * Toggles the browser Picture-in-Picture window using the largest visible
 * video tile on stage. Returns true when PiP was opened, false when it was
 * closed (or is unsupported).
 */
export async function togglePictureInPicture(): Promise<boolean> {
  if (typeof document === 'undefined') return false

  if (document.pictureInPictureElement) {
    try {
      await document.exitPictureInPicture()
    } catch {
      // ignore
    }
    return false
  }

  if (!document.pictureInPictureEnabled) return false

  const videos = Array.from(document.querySelectorAll('video')).filter((video) => {
    const rect = video.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0
  })

  let best: HTMLVideoElement | null = null
  let bestArea = 0
  for (const video of videos) {
    const rect = video.getBoundingClientRect()
    const area = rect.width * rect.height
    if (area > bestArea) {
      bestArea = area
      best = video
    }
  }

  if (!best) return false

  try {
    await best.requestPictureInPicture()
    return true
  } catch {
    return false
  }
}
