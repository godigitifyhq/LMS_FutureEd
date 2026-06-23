import { buildServer } from "./server";
import { config } from "./config";
import { startFollowUpCron } from "./jobs/followUp";
import { startDailyReportCron } from "./jobs/dailyReport";
import { startNotificationWorker } from "./workers/notifications";
import { verifyEmailConnection } from "./services/email";
import { subscribePageToApp } from "./services/metaLeadForm";

async function main() {
  const fastify = await buildServer();
  let notificationWorker: ReturnType<typeof startNotificationWorker> | null =
    null;

  // Start background jobs after server is ready
  fastify.addHook("onReady", async () => {
    startFollowUpCron(fastify);
    startDailyReportCron(fastify);
    notificationWorker = startNotificationWorker(fastify.redis as any);
    // Fire-and-forget — SMTP verify is diagnostic only and must not block startup
    void verifyEmailConnection();
    void subscribePageToApp();
  });

  fastify.addHook("onClose", async () => {
    if (notificationWorker) {
      await notificationWorker.close();
    }
  });

  try {
    await fastify.listen({
      port: config.port,
      host: "0.0.0.0", // required for DigitalOcean
    });
  } catch (error) {
    fastify.log.error(error);
    process.exit(1);
  }
}

void main();
