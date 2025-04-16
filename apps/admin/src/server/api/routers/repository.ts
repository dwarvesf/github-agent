import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { z } from 'zod'

export const repositoryRouter = createTRPCRouter({
  getByOrganization: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const repositories = await ctx.db.repository.findMany({
        where: { organization_id: input },
        orderBy: { created_at: 'desc' },
      })
      return repositories
    }),

  create: publicProcedure
    .input(
      z.object({
        github_repo_name: z.string().min(1),
        organization_id: z.number(),
        channel_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const repository = await ctx.db.repository.create({
        data: {
          github_repo_name: input.github_repo_name.trim(),
          organization_id: input.organization_id,
          channel_id: input.channel_id,
        },
      })
      return repository
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        github_repo_name: z.string().min(1),
        organization_id: z.number(),
        channel_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const repository = await ctx.db.repository.update({
        where: { id: input.id },
        data: {
          github_repo_name: input.github_repo_name.trim(),
          organization_id: input.organization_id,
          channel_id: input.channel_id,
        },
      })
      return repository
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.repository.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),
})
