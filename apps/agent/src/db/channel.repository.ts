import type { Channel, Prisma } from './.generated/client'
import { getPrisma } from './connection'

/**
 * Repository for Channel-related database operations
 */
export class ChannelRepository {
  /**
   * Create a new channel
   */
  static async create(data: Prisma.ChannelCreateInput): Promise<Channel> {
    const prisma = getPrisma()
    return prisma.channel.create({ data })
  }

  /**
   * Get channel by ID
   */
  static async getById(id: number): Promise<Channel | null> {
    const prisma = getPrisma()
    return prisma.channel.findUnique({ where: { id } })
  }

  /**
   * Update channel
   */
  static async update(
    id: number,
    data: Prisma.ChannelUpdateInput,
  ): Promise<Channel> {
    const prisma = getPrisma()
    return prisma.channel.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete channel
   */
  static async delete(id: number): Promise<Channel> {
    const prisma = getPrisma()
    return prisma.channel.delete({ where: { id } })
  }

  /**
   * List all channels with optional filtering and pagination
   */
  static async list(params: {
    where?: Prisma.ChannelWhereInput
    orderBy?: Prisma.ChannelOrderByWithRelationInput
    skip?: number
    take?: number
  }) {
    const prisma = getPrisma()
    const { where, orderBy, skip, take } = params
    return prisma.channel.findMany({
      where,
      orderBy,
      skip,
      take,
    })
  }

  /**
   * Get channels by organization
   */
  static async getByOrganization(params: {
    where?: Prisma.ChannelWhereInput
    orderBy?: Prisma.ChannelOrderByWithRelationInput
  }) {
    const prisma = getPrisma()
    const { where = {}, orderBy } = params
    return prisma.channel.findMany({
      where,
      orderBy: orderBy || { createdAt: 'desc' },
    })
  }

  /**
   * Get channel by unique identifiers
   */
  static async getUnique(
    where: Prisma.ChannelWhereUniqueInput,
  ): Promise<Channel | null> {
    const prisma = getPrisma()
    return prisma.channel.findUnique({ where })
  }
}
