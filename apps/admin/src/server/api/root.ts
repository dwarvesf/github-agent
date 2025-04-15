import { orgRouter } from "@/server/api/routers/organization";
import { membersRouter } from "@/server/api/routers/members";
import { channelRouter } from "@/server/api/routers/channel";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
import { repositoryRouter } from "@/server/api/routers/repository";

export const appRouter = createTRPCRouter({
  organization: orgRouter,
  members: membersRouter,
  channel: channelRouter,
  repository: repositoryRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
