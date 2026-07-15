export function formatRelativeDays(days: number): string {
  const wholeDays = Math.floor(days)
  if (wholeDays <= 0) return 'heute'
  if (wholeDays === 1) return 'vor 1 Tag'
  if (wholeDays < 14) return `vor ${wholeDays} Tagen`
  const weeks = Math.floor(wholeDays / 7)
  if (weeks === 1) return 'vor 1 Woche'
  return `vor ${weeks} Wochen`
}
