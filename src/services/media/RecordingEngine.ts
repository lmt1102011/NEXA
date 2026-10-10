const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'audio/webm',
]

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type))
}

export interface RecordingResult {
  blob: Blob
  fileName: string
  durationMs: number
}

type ResultListener = (result: RecordingResult) => void

/**
 * Records a MediaStream locally with MediaRecorder and hands the finished
 * blob back through a callback. Kept outside React so a recording survives
 * re-renders and route transitions, and so the caller decides what happens
 * to the file (download, share, upload…).
 */
export class RecordingEngine {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private outputType = 'video/webm'
  private startedAt = 0
  private resultListeners = new Set<ResultListener>()

  get supported(): boolean {
    return typeof MediaRecorder !== 'undefined' && typeof pickMimeType() !== 'undefined'
  }

  get recording(): boolean {
    return this.recorder?.state === 'recording'
  }

  get elapsedMs(): number {
    return this.startedAt === 0 ? 0 : Date.now() - this.startedAt
  }

  /** Begins recording `stream`. Returns false when unsupported or already busy. */
  start(stream: MediaStream): boolean {
    if (this.recorder) return false
    const mimeType = pickMimeType()
    if (!mimeType || stream.getTracks().length === 0) return false
    try {
      this.recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      })
    } catch {
      this.recorder = null
      return false
    }

    this.chunks = []
    this.outputType = mimeType.startsWith('audio') ? 'audio/webm' : 'video/webm'
    this.recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data)
    }
    this.recorder.onstop = () => this.finish()
    this.startedAt = Date.now()
    this.recorder.start(1000)
    return true
  }

  /** Stops the active recording. The result is delivered to `onResult`. */
  stop(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.recorder.stop()
    }
  }

  onResult(listener: ResultListener): () => void {
    this.resultListeners.add(listener)
    return () => {
      this.resultListeners.delete(listener)
    }
  }

  private finish() {
    const durationMs = this.startedAt === 0 ? 0 : Date.now() - this.startedAt
    this.startedAt = 0
    this.recorder = null
    if (this.chunks.length === 0) return
    const blob = new Blob(this.chunks, { type: this.outputType })
    this.chunks = []
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const result: RecordingResult = { blob, fileName: `nexa-recording-${stamp}.webm`, durationMs }
    for (const listener of this.resultListeners) listener(result)
  }
}

export const recordingEngine = new RecordingEngine()
