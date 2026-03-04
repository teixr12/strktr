export type LatencyBucket = '<0.8s' | '0.8s-2s' | '2s+'

export function getLatencyBucket(latencyMs: number): LatencyBucket {
  if (latencyMs >= 2000) return '2s+'
  if (latencyMs >= 800) return '0.8s-2s'
  return '<0.8s'
}
