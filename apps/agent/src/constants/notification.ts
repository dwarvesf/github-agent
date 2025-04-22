export const NOTIFICATION_CONFIG = {
  initialInterval: 30 * 60 * 1000, // 30 minutes
  multiplier: 2, // Exponential growth factor
  maxInterval: 4 * 60 * 60 * 1000, // 4 hours (cap)
}
