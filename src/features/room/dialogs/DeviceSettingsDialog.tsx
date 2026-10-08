import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, Mic, MicOff, Volume2 } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select'
import { ToggleRow } from '@/components/ui/switch'
import { mediaEngine } from '@/services/media/MediaEngine'
import { useCallStore } from '@/stores/call'
import { useRoomSessionStore } from '@/stores/roomSession'
import { useUiStore } from '@/stores/ui'
import { switchDevice } from '@/features/room/session/sessionController'

export function DeviceSettingsDialog() {
  const modal = useUiStore((state) => state.modal)
  const setModal = useUiStore((state) => state.setModal)
  const room = useRoomSessionStore((state) => state.room)

  const devices = useCallStore((state) => state.devices)
  const activeAudioId = useCallStore((state) => state.activeAudioId)
  const activeVideoId = useCallStore((state) => state.activeVideoId)
  const activeOutputId = useCallStore((state) => state.activeOutputId)
  const setActiveDevice = useCallStore((state) => state.setActiveDevice)
  const audioPermission = useCallStore((state) => state.audioPermission)
  const videoPermission = useCallStore((state) => state.videoPermission)
  const micOn = useCallStore((state) => state.micOn)
  const cameraOn = useCallStore((state) => state.cameraOn)

  const [noiseSuppression, setNoiseSuppression] = useState(room?.settings.av.noiseSuppression ?? true)
  const [echoCancellation, setEchoCancellation] = useState(room?.settings.av.echoCancellation ?? true)
  const [voiceDetected, setVoiceDetected] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (modal !== 'devices') return
    const off = mediaEngine.onSpeakingChange((speaking) => setVoiceDetected(speaking))
    mediaEngine.setPreferences({ noiseSuppression, echoCancellation })
    return off
  }, [modal, noiseSuppression, echoCancellation])

  useEffect(() => {
    if (modal !== 'devices') return
    const video = videoRef.current
    if (!video) return
    const stream = mediaEngine.getStream()
    video.srcObject = stream
    if (stream) void video.play().catch(() => undefined)
  }, [modal, cameraOn, micOn])

  const micOptions = [
    { value: '__default', label: 'System default microphone' },
    ...devices.audio.map((device) => ({ value: device.deviceId, label: device.label })),
  ]
  const camOptions = [
    { value: '__default', label: 'System default camera' },
    ...devices.video.map((device) => ({ value: device.deviceId, label: device.label })),
  ]
  const speakerOptions = [
    { value: '__default', label: 'System default speaker' },
    ...devices.output.map((device) => ({ value: device.deviceId, label: device.label })),
  ]

  return (
    <Dialog
      open={modal === 'devices'}
      onOpenChange={(open) => {
        if (!open) setModal(null)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Device settings</DialogTitle>
          <DialogDescription>Preview and switch devices before or during the call.</DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pb-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-[#0a0c12]">
            {cameraOn && videoPermission === 'granted' ? (
              <video ref={videoRef} muted playsInline autoPlay className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <CameraOff className="mx-auto h-6 w-6 text-ink-subtle" />
                  <p className="mt-2 text-[12.5px] text-ink-subtle">Camera is off</p>
                </div>
              </div>
            )}
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-lg bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur">
              <span
                className={
                  voiceDetected
                    ? 'h-2 w-2 rounded-full bg-success'
                    : 'h-2 w-2 rounded-full bg-white/50'
                }
              />
              {voiceDetected ? 'Voice detected' : 'Mic ready'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Microphone</span>
              <SelectField
                value={activeAudioId || '__default'}
                options={micOptions}
                ariaLabel="Microphone"
                disabled={audioPermission !== 'granted'}
                onChange={(value) => {
                  if (value !== '__default') void switchDevice('audio', value)
                }}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Camera</span>
              <SelectField
                value={activeVideoId || '__default'}
                options={camOptions}
                ariaLabel="Camera"
                disabled={videoPermission !== 'granted'}
                onChange={(value) => {
                  if (value !== '__default') void switchDevice('video', value)
                }}
              />
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-ink-muted">Speaker</span>
            <SelectField
              value={activeOutputId || '__default'}
              options={speakerOptions}
              ariaLabel="Speaker"
              onChange={(value) => {
                if (value !== '__default') setActiveDevice('output', value)
              }}
            />
          </div>

          <div className="divide-y divide-[var(--nx-line)] rounded-xl border border-line bg-surface-2 px-3">
            <ToggleRow
              label="Noise suppression"
              description="Filters background noise from your mic."
              checked={noiseSuppression}
              onCheckedChange={setNoiseSuppression}
            />
            <ToggleRow
              label="Echo cancellation"
              description="Prevents speaker output from feeding back."
              checked={echoCancellation}
              onCheckedChange={setEchoCancellation}
            />
          </div>

          <div className="flex items-center gap-3 text-[12.5px] text-ink-subtle">
            <span className="inline-flex items-center gap-1.5">
              {micOn ? <Mic className="h-3.5 w-3.5 text-success" /> : <MicOff className="h-3.5 w-3.5 text-danger" />}
              {micOn ? 'Microphone on' : 'Microphone muted'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              {cameraOn ? <Camera className="h-3.5 w-3.5 text-success" /> : <CameraOff className="h-3.5 w-3.5 text-danger" />}
              {cameraOn ? 'Camera on' : 'Camera off'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5" />
              Speaker preview
            </span>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => setModal(null)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
