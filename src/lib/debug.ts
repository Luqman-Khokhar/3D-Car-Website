/** True when the page was loaded with ?debug=1. Gates the scene debug bridge. */
export function debugEnabled() {
  return (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('debug')
  )
}
