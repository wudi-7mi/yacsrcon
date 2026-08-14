export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startMetricSampler } = await import("./lib/metrics.ts");
  startMetricSampler();
}
