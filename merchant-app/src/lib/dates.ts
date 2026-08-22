export const DEMO_NOW_ISO = '2026-08-22T14:35:00+05:30'

export function parseISO(iso: string): Date {
  return new Date(iso)
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function formatDayLabel(iso: string, nowIso: string): string {
  const d = parseISO(iso)
  const now = parseISO(nowIso)
  if (isSameDay(d, now)) return 'Today'
  if (isSameDay(d, addDays(now, -1))) return 'Yesterday'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  })
}

export function formatTime(iso: string): string {
  return parseISO(iso).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDateTime(iso: string): string {
  return `${formatDayLabel(iso, DEMO_NOW_ISO)}, ${formatTime(iso)}`
}

export function weekdayName(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'long' })
}

export function toISO(date: Date): string {
  return date.toISOString()
}
