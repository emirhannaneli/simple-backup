export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getScheduler } = await import("./lib/scheduler");
    const scheduler = getScheduler();
    await scheduler.initialize();
  }
}


