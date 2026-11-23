import { useCallback, useEffect, useState } from 'react'
import type { CliStatus, Profile, PublicSettings } from '@shared/types'

/** Loads the saved profile; `reload` refreshes it (also on the 'profile-changed' event). */
export function useProfile(): { profile: Profile | null; loaded: boolean; reload: () => Promise<void> } {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const reload = useCallback(async () => {
    try {
      setProfile(await window.careerer.profile.get())
    } finally {
      setLoaded(true)
    }
  }, [])
  useEffect(() => {
    void reload()
    const h = (): void => void reload()
    window.addEventListener('profile-changed', h)
    return () => window.removeEventListener('profile-changed', h)
  }, [reload])
  return { profile, loaded, reload }
}

export function useSettings(): {
  settings: PublicSettings | null
  setSettings: (s: PublicSettings) => void
} {
  const [settings, setSettings] = useState<PublicSettings | null>(null)
  useEffect(() => {
    void window.careerer.settings.get().then(setSettings)
  }, [])
  return { settings, setSettings }
}

export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']*': (Error: )?/, '') : 'Something went wrong.'
}

/** Claude CLI availability, checked once per mount (skipped in mock mode). */
export function useCli(): CliStatus | null {
  const [cli, setCli] = useState<CliStatus | null>(null)
  useEffect(() => {
    if (window.careerer.isMock) return
    void window.careerer.cli.status().then(setCli, (e) => setCli({ found: false, problem: errMsg(e) }))
  }, [])
  return cli
}
