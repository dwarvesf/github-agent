import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const orgRouter = createTRPCRouter({
  getLatest: publicProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.organization.findFirst({
      orderBy: { created_at: "desc" },
    });

    return orgs ?? null;
  }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    const orgs = await ctx.db.organization.findMany({
      orderBy: { created_at: "desc" },
      include: {
        _count: {
          select: { repositories: true },
        },
      },
    });
    return orgs;
  }),

  create: publicProcedure
    .input(
      z.object({
        github_name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.create({
        data: {
          github_name: input.github_name,
        },
      });
      return org;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        github_name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const org = await ctx.db.organization.update({
        where: { id: input.id },
        data: {
          github_name: input.github_name,
        },
      });
      return org;
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.organization.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),
});
