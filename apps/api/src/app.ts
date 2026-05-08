import { buildServer } from "./server";
import { config } from "./config";
import { startFollowUpCron } from "./jobs/followUp";

async function main() {
  const fastify = await buildServer();

  // Start background jobs after server is ready
  fastify.addHook("onReady", () => {
    startFollowUpCron(fastify);
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
