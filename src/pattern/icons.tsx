import type { PatternId } from './catalog'

export function PatternIcon({ id }: { id: PatternId }) {
  if (id === 'flutes-v') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M11 8v24M16 8v24M21 8v24" />
      </svg>
    )
  }
  if (id === 'flutes-h') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M9 12h14M9 20h14M9 28h14" />
      </svg>
    )
  }
  if (id === 'grid') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M12 8v24M20 8v24M9 14h14M9 26h14" />
      </svg>
    )
  }
  if (id === 'diamonds') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M16 10l5 6-5 6-5-6zM16 22l4 5-4 5-4-5z" />
      </svg>
    )
  }
  if (id === 'chevron') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M9 12l4-4 4 4 4-4M9 22l4-4 4 4 4-4M9 32l4-4 4 4 4-4" />
      </svg>
    )
  }
  if (id === 'waves') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <path d="M9 14c3-4 5 4 8 0s5 4 8 0M9 24c3-4 5 4 8 0s5 4 8 0" />
      </svg>
    )
  }
  if (id === 'circles') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <circle cx="13" cy="14" r="3" />
        <circle cx="21" cy="14" r="3" />
        <circle cx="13" cy="26" r="3" />
        <circle cx="21" cy="26" r="3" />
      </svg>
    )
  }
  if (id === 'ripples') {
    return (
      <svg viewBox="0 0 32 40" aria-hidden="true">
        <rect x="6" y="4" width="20" height="32" rx="1" />
        <circle cx="12" cy="16" r="3" />
        <circle cx="12" cy="16" r="6" />
        <circle cx="12" cy="16" r="9" />
        <circle cx="22" cy="26" r="3" />
        <circle cx="22" cy="26" r="6" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 32 40" aria-hidden="true">
      <rect x="6" y="4" width="20" height="32" rx="1" />
    </svg>
  )
}
