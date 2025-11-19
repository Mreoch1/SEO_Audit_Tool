/**
 * Cron Expression Utilities
 */

import parser from 'cron-parser'

/**
 * Validate cron expression
 */
export function isValidCronExpression(expression: string): boolean {
  try {
    parser.parseExpression(expression)
    return true
  } catch {
    return false
  }
}

/**
 * Get next run time from cron expression
 */
export function getNextRunTime(expression: string, fromDate?: Date): Date {
  const interval = parser.parseExpression(expression, {
    currentDate: fromDate || new Date()
  })
  return interval.next().toDate()
}

/**
 * Check if scheduled audit should run now
 */
export function shouldRunNow(
  cronExpression: string,
  lastRunAt: Date | null
): boolean {
  if (!isValidCronExpression(cronExpression)) {
    return false
  }

  const now = new Date()
  const nextRun = getNextRunTime(cronExpression, lastRunAt || undefined)

  // Run if next run time is in the past (within last 15 minutes to account for cron interval)
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  return nextRun <= now && (lastRunAt === null || lastRunAt < fifteenMinutesAgo)
}

