import { createTRPCRouter, publicProcedure } from '@/server/api/trpc'
import { z } from 'zod'

export const channelRouter = createTRPCRouter({
  getByOrganization: publicProcedure
    .input(z.number())
    .query(async ({ ctx, input }) => {
      const channels = await ctx.db.channel.findMany({
        where: { organization_id: input },
        orderBy: { created_at: 'desc' },
      })
      return channels
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        platform: z.enum(['discord', 'slack']),
        platform_channel_id: z.string().min(1),
        organization_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.create({
        data: {
          name: input.name.trim(),
          platform: input.platform,
          platform_channel_id: input.platform_channel_id.trim(),
          organization_id: input.organization_id,
        },
      })
      return channel
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1),
        platform: z.enum(['discord', 'slack']),
        platform_channel_id: z.string().min(1),
        organization_id: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const channel = await ctx.db.channel.update({
        where: { id: input.id },
        data: {
          name: input.name.trim(),
          platform: input.platform,
          platform_channel_id: input.platform_channel_id.trim(),
          organization_id: input.organization_id,
        },
      })
      return channel
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.channel.delete({
        where: { id: input.id },
      })
      return { success: true }
    }),
})
