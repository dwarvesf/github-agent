import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const membersRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.member.findMany();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return await ctx.db.member.findUnique({
        where: { id: input.id },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        github_id: z.string(),
        platform_id: z.string(),
        platform_type: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.member.create({
        data: {
          github_id: input.github_id,
          platform_id: input.platform_id,
          platform_type: input.platform_type,
        },
      });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        github_id: z.string(),
        platform_id: z.string(),
        platform_type: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.member.update({
        where: { id: input.id },
        data: {
          github_id: input.github_id,
          platform_id: input.platform_id,
          platform_type: input.platform_type,
        },
      });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.member.delete({
        where: { id: input.id },
      });
    }),
});
