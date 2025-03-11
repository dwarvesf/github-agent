import { Mastra } from "@mastra/core/mastra";
import { createLogger } from "@mastra/core/logger";
import { notifyDeveloperPRRequestWorkflow } from "./workflows/github-notify-open-prs";
import { analyzePRsAgent } from "./agents";

export const mastra = new Mastra({
  workflows: {
    notifyDeveloperPRRequestWorkflow,
  },
  agents: {
    analyzePRsAgent,
  },
  logger: createLogger({
    name: "GH-AGENT",
    level: "info",
  }),
});
