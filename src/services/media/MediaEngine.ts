import type { DeviceOption } from '@/types'
import type { PermissionStatus } from '@/stores/call'

export interface PrepareResult {
  audio: PermissionStatus
  video: PermissionStatus
}

export interface MediaConstraintsPrefs {
  echoCancellation: boolean
  noiseSuppression: boolean
}

type StreamListener = () => void
type SpeakingListener = (speaking: boolean) => void

const SPEAKING_THRESHOLD = 0.045
const SPEAKING_RELEASE = 0.03

/**
 * Owns every local media resource: camera/mic capture, device switching,
 * screen sharing and input-level detection. Kept outside React so peer
 * connections and streams survive re-renders and route transitions.
 */
export class MediaEngine {
  private stream: MediaStream | null = null
  private screenStream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private levelBuffer: Uint8Array<ArrayBuffer> | null = null
  private rafId = 0
  private speaking = false
  private prefs: MediaConstraintsPrefs = { echoCancellation: true, noiseSuppression: true }
  private preferredAudioId = ''
  private preferredVideoId = ''
  private streamListeners = new Set<StreamListener>()
  private speakingListeners = new Set<SpeakingListener>()

  async prepare(options: { audio: boolean; video: boolean }): Promise<PrepareResult> {
    const result: PrepareResult = {
      audio: options.audio ? 'unknown' : 'unknown',
      video: options.video ? 'unknown' : 'unknown',
    }
    if (!options.audio && !options.video) return result

    if (options.audio) result.audio = await this.startAudio()
    if (options.video) result.video = await this.startVideo()

    if (this.stream && this.stream.getTracks().length > 0) {
      this.startLevelMonitor()
      this.notifyStream()
    }
    return result
  }

  private async startAudio(): Promise<PermissionStatus> {
    if (this.hasAudioTrack()) return 'granted'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: this.prefs.echoCancellation,
          noiseSuppression: this.prefs.noiseSuppression,
          ...(this.preferredAudioId ? { deviceId: { exact: this.preferredAudioId } } : {}),
        },
        video: false,
      })
      this.mergeInto(stream)
      return 'granted'
    } catch (error) {
      return mapMediaError(error)
    }
  }

  private async startVideo(): Promise<PermissionStatus> {
    if (this.hasVideoTrack()) return 'granted'
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          ...(this.preferredVideoId ? { deviceId: { exact: this.preferredVideoId } } : {}),
        },
      })
      this.mergeInto(stream)
      return 'granted'
    } catch (error) {
      return mapMediaError(error)
    }
  }

  private mergeInto(incoming: MediaStream) {
    const existing = this.stream ?? new MediaStream()
    const existingIds = new Set(existing.getTracks().map((track) => track.id))
    for (const track of incoming.getTracks()) {
      if (!existingIds.has(track.id)) existing.addTrack(track)
    }
    this.stream = existing
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  getScreenStream(): MediaStream | null {
    return this.screenStream
  }

  hasVideoTrack(): boolean {
    return Boolean(this.stream?.getVideoTracks().some((track) => track.readyState === 'live'))
  }

  hasAudioTrack(): boolean {
    return Boolean(this.stream?.getAudioTracks().some((track) => track.readyState === 'live'))
  }

  setMic(enabled: boolean) {
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = enabled
    if (!enabled && this.speaking) this.updateSpeaking(false)
  }

  setCamera(enabled: boolean) {
    for (const track of this.stream?.getVideoTracks() ?? []) track.enabled = enabled
    this.notifyStream()
  }

  setPreferences(prefs: MediaConstraintsPrefs) {
    this.prefs = prefs
  }

  async switchAudioDevice(deviceId: string): Promise<PermissionStatus> {
    this.preferredAudioId = deviceId
    const wasEnabled = this.stream?.getAudioTracks()[0]?.enabled ?? true
    this.removeTracks('audio')
    const status = await this.startAudio()
    this.setMic(wasEnabled)
    this.startLevelMonitor()
    this.notifyStream()
    return status
  }

  async switchVideoDevice(deviceId: string): Promise<PermissionStatus> {
    this.preferredVideoId = deviceId
    const wasEnabled = this.stream?.getVideoTracks()[0]?.enabled ?? true
    this.removeTracks('video')
    const status = await this.startVideo()
    this.setCamera(wasEnabled)
    this.notifyStream()
    return status
  }

  async enumerateDevices(): Promise<{
    audio: DeviceOption[]
    video: DeviceOption[]
    output: DeviceOption[]
  }> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { audio: [], video: [], output: [] }
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      audio: devices
        .filter((device) => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Microphone ${index + 1}`,
        })),
      video: devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${index + 1}`,
        })),
      output: devices
        .filter((device) => device.kind === 'audiooutput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Speaker ${index + 1}`,
        })),
    }
  }

  async startScreenShare(): Promise<boolean> {
    if (this.screenStream) return true
    if (!navigator.mediaDevices?.getDisplayMedia) return false
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false,
      })
      this.screenStream = stream
      const [track] = stream.getVideoTracks()
      track.addEventListener('ended', () => this.stopScreenShare())
      this.notifyStream()
      return true
    } catch {
      return false
    }
  }

  stopScreenShare() {
    if (!this.screenStream) return
    for (const track of this.screenStream.getTracks()) track.stop()
    this.screenStream = null
    this.notifyStream()
  }

  dispose() {
    this.stopScreenShare()
    this.removeTracks('audio')
    this.removeTracks('video')
    this.stream = null
    this.stopLevelMonitor()
    this.audioContext?.close().catch(() => undefined)
    this.audioContext = null
    this.analyser = null
    this.streamListeners.clear()
    this.speakingListeners.clear()
  }

  onStreamChange(listener: StreamListener) {
    this.streamListeners.add(listener)
    return () => {
      this.streamListeners.delete(listener)
    }
  }

  onSpeakingChange(listener: SpeakingListener) {
    this.speakingListeners.add(listener)
    return () => {
      this.speakingListeners.delete(listener)
    }
  }

  private removeTracks(kind: 'audio' | 'video') {
    if (!this.stream) return
    const tracks = kind === 'audio' ? this.stream.getAudioTracks() : this.stream.getVideoTracks()
    for (const track of tracks) {
      this.stream.removeTrack(track)
      track.stop()
    }
    if (this.stream.getTracks().length === 0) this.stream = null
    this.notifyStream()
  }

  private notifyStream() {
    for (const listener of this.streamListeners) listener()
  }

  private startLevelMonitor() {
    if (this.rafId !== 0 || !this.stream) return
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    try {
      this.audioContext ??= new AudioContextCtor()
      if (this.audioContext.state === 'suspended') void this.audioContext.resume()
      const source = this.audioContext.createMediaStreamSource(this.stream)
      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 512
      this.analyser.smoothingTimeConstant = 0.75
      source.connect(this.analyser)
      this.levelBuffer = new Uint8Array(this.analyser.fftSize)
    } catch {
      return
    }

    const tick = () => {
      this.sampleLevel()
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private stopLevelMonitor() {
    if (this.rafId !== 0) cancelAnimationFrame(this.rafId)
    this.rafId = 0
  }

  private sampleLevel() {
    if (!this.analyser || !this.levelBuffer) return
    this.analyser.getByteTimeDomainData(this.levelBuffer)
    let sum = 0
    for (let i = 0; i < this.levelBuffer.length; i += 1) {
      const value = (this.levelBuffer[i] - 128) / 128
      sum += value * value
    }
    const rms = Math.sqrt(sum / this.levelBuffer.length)
    const audioEnabled = this.stream?.getAudioTracks()[0]?.enabled ?? false
    const next = audioEnabled && rms > (this.speaking ? SPEAKING_RELEASE : SPEAKING_THRESHOLD)
    if (next !== this.speaking) this.updateSpeaking(next)
  }

  private updateSpeaking(speaking: boolean) {
    this.speaking = speaking
    for (const listener of this.speakingListeners) listener(speaking)
  }
}

function mapMediaError(error: unknown): PermissionStatus {
  const name = (error as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied'
  if (
    name === 'NotFoundError' ||
    name === 'OverconstrainedError' ||
    name === 'NotReadableError' ||
    name === 'AbortError'
  ) {
    return 'unavailable'
  }
  return 'unavailable'
}

export const mediaEngine = new MediaEngine()
