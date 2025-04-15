import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const orgRouter = createTRPCRouter({
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.organization.findFirst({
      orderBy: { created_at: "desc" },
    });

    return orgs ?? null;
  }),
});
