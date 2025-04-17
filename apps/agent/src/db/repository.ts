import type { Prisma, Repository } from './.generated/client'
import { getPrisma } from './connection'

/**
 * Repository for Repository-related database operations
 */
export class Repositories {
  /**
   * Create a new repository
   */
  static async create(data: Prisma.RepositoryCreateInput): Promise<Repository> {
    const prisma = getPrisma()
    return prisma.repository.create({ data })
  }

  /**
   * Get repository by ID
   */
  static async getById(id: number): Promise<Repository | null> {
    const prisma = getPrisma()
    return prisma.repository.findUnique({ where: { id } })
  }

  /**
   * Update repository
   */
  static async update(
    id: number,
    data: Prisma.RepositoryUpdateInput,
  ): Promise<Repository> {
    const prisma = getPrisma()
    return prisma.repository.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete repository
   */
  static async delete(id: number): Promise<Repository> {
    const prisma = getPrisma()
    return prisma.repository.delete({ where: { id } })
  }

  /**
   * List all repositories with optional filtering and pagination
   */
  static async list(params: {
    where?: Prisma.RepositoryWhereInput
    orderBy?: Prisma.RepositoryOrderByWithRelationInput
    skip?: number
    take?: number
  }) {
    const prisma = getPrisma()
    const { where, orderBy, skip, take } = params
    return prisma.repository.findMany({
      where,
      orderBy,
      skip,
      take,
    })
  }

  /**
   * Get repositories by organization
   */
  static async getByOrganization(params: {
    where?: Prisma.RepositoryWhereInput
    orderBy?: Prisma.RepositoryOrderByWithRelationInput
    skip?: number
    take?: number
  }) {
    const prisma = getPrisma()
    const { where = {}, orderBy, skip, take } = params
    return prisma.repository.findMany({
      where,
      orderBy: orderBy || { createdAt: 'desc' },
      skip,
      take,
    })
  }

  /**
   * Get repositories by channel
   */
  static async getByChannel(params: {
    channelId: number
    organizationId: number
    repository?: string
    orderBy?: Prisma.RepositoryOrderByWithRelationInput
  }) {
    const prisma = getPrisma()
    const { channelId, organizationId, repository, orderBy } = params
    return prisma.repository.findMany({
      where: {
        organizationId,
        channelId,
        githubRepoName: repository,
      },
      orderBy: orderBy || { createdAt: 'desc' },
    })
  }

  /**
   * Get repository by unique identifiers
   */
  static async getUnique(
    where: Prisma.RepositoryWhereUniqueInput,
  ): Promise<Repository | null> {
    const prisma = getPrisma()
    return prisma.repository.findUnique({ where })
  }

  /**
   * Get repository by repository name
   */
  static async getByRepositoryName(
    repositoryName: string,
  ): Promise<Repository[]> {
    const prisma = getPrisma()
    return prisma.repository.findMany({
      where: { githubRepoName: repositoryName },
    })
  }
}
