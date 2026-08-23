import { Capacitor } from '@capacitor/core'
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth'

export type BiometricResult = 'success' | 'cancelled' | 'unavailable' | 'failure'

export function isNativeBiometricSupported(): boolean {
  return Capacitor.isNativePlatform()
}

export async function authenticateWithBiometrics(): Promise<BiometricResult> {
  if (!isNativeBiometricSupported()) return 'unavailable'
  try {
    await BiometricAuth.authenticate({
      reason: 'Unlock Ledger to decrypt your data',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Ledger Locked',
      androidSubtitle: 'Use your fingerprint or face to unlock',
    })
    return 'success'
  } catch {
    return 'cancelled'
  }
}