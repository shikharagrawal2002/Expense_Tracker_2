// Receipt capture button using @capacitor/camera.
//
// On Android this opens the native camera (or gallery) and returns a base64
// JPEG. On web it falls back to the browser file picker. The captured image
// is returned as a data URL the caller can attach to a transaction.

import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Camera as CameraIcon, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReceiptCaptureProps {
  onCapture: (dataUrl: string) => void
  disabled?: boolean
}

export function ReceiptCapture({ onCapture, disabled }: ReceiptCaptureProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = async () => {
    setBusy(true)
    setError(null)
    try {
      if (Capacitor.isNativePlatform()) {
        const photo = await Camera.getPhoto({
          quality: 70,
          width: 1280,
          resultType: CameraResultType.DataUrl,
          source: CameraSource.Prompt, // camera or gallery
        })
        if (photo.dataUrl) onCapture(photo.dataUrl)
      } else {
        // Web fallback: file picker
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.onchange = () => {
          const file = input.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = () => onCapture(reader.result as string)
          reader.readAsDataURL(file)
        }
        input.click()
      }
    } catch (e) {
      const err = e as { message?: string }
      if (!err?.message?.includes('cancel') && !err?.message?.includes('User cancelled')) {
        setError('Could not capture receipt.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="sm" onClick={() => void capture()} disabled={disabled || busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CameraIcon className="h-3.5 w-3.5" />}
        Capture receipt
      </Button>
      {error && <span className="text-xs text-[var(--color-negative-600)]">{error}</span>}
    </div>
  )
}