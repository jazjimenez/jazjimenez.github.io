import { useEffect, useState } from 'react'

const TZ = 'Asia/Manila'

export function manilaHour(d = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', hourCycle: 'h23' }).format(d))
}

export function isManilaNight(d = new Date()): boolean {
  const h = manilaHour(d)
  return h < 6 || h >= 18
}

/** Current time in Manila, refreshed every 15 seconds. */
export function useManilaClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000)
    return () => clearInterval(id)
  }, [])
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(now)
  return { now, label, hour: manilaHour(now) }
}

export type Weather = { temp: number; label: string; icon: string; rainy: boolean }

// WMO weather codes → short label + icon
function describe(code: number): Omit<Weather, 'temp'> {
  if (code === 0) return { label: 'Clear', icon: '☀', rainy: false }
  if (code <= 3) return { label: 'Cloudy', icon: '⛅', rainy: false }
  if (code <= 48) return { label: 'Fog', icon: '🌫', rainy: false }
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: 'Rain', icon: '🌧', rainy: true }
  if (code >= 95) return { label: 'Storm', icon: '⛈', rainy: true }
  return { label: 'Cloudy', icon: '☁', rainy: false }
}

/** Current Manila weather from Open-Meteo (free, no API key). Null until loaded or on failure. */
export function useManilaWeather(): Weather | null {
  const [weather, setWeather] = useState<Weather | null>(null)
  useEffect(() => {
    const ctrl = new AbortController()
    fetch('https://api.open-meteo.com/v1/forecast?latitude=14.5995&longitude=120.9842&current=temperature_2m,weather_code', {
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        const c = j?.current
        if (typeof c?.temperature_2m === 'number') setWeather({ temp: Math.round(c.temperature_2m), ...describe(c.weather_code) })
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return weather
}
