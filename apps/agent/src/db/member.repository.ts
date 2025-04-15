import type { $Enums, Member, Prisma } from './.generated/client'
import { getPrisma } from './connection'

/**
 * Repository for Member-related database operations
 */
export class MemberRepository {
  /**
   * Create a new member
   */
  static async create(data: Prisma.MemberCreateInput): Promise<Member> {
    const prisma = getPrisma()
    return prisma.member.create({ data })
  }

  /**
   * Get member by ID
   */
  static async getById(id: number): Promise<Member | null> {
    const prisma = getPrisma()
    return prisma.member.findUnique({ where: { id } })
  }

  /**
   * Update member
   */
  static async update(
    id: number,
    data: Prisma.MemberUpdateInput,
  ): Promise<Member> {
    const prisma = getPrisma()
    return prisma.member.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete member
   */
  static async delete(id: number): Promise<Member> {
    const prisma = getPrisma()
    return prisma.member.delete({ where: { id } })
  }

  /**
   * List all members with optional filtering and pagination
   */
  static async list(params: {
    where?: Prisma.MemberWhereInput
    orderBy?: Prisma.MemberOrderByWithRelationInput
    skip?: number
    take?: number
  }) {
    const prisma = getPrisma()
    const { where, orderBy, skip, take } = params
    return prisma.member.findMany({
      where,
      orderBy,
      skip,
      take,
    })
  }

  /**
   * Get members by platform
   */
  static async getByPlatform(params: {
    platform: string
    orderBy?: Prisma.MemberOrderByWithRelationInput
  }) {
    const prisma = getPrisma()
    const { platform, orderBy } = params
    return prisma.member.findMany({
      where: {
        platformType: platform,
      },
      orderBy: orderBy || { createdAt: 'desc' },
    })
  }

  /**
   * Get members by githubId
   */
  static async getByGithubId(githubId: string) {
    const prisma = getPrisma()
    return prisma.member.findMany({
      where: {
        githubId,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get member by unique identifiers
   */
  static async getUnique(
    where: Prisma.MemberWhereUniqueInput,
  ): Promise<Member | null> {
    const prisma = getPrisma()
    return prisma.member.findUnique({ where })
  }
}
