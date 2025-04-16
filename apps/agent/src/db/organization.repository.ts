import type { Organization, Prisma } from './.generated/client'
import { getPrisma } from './connection'

/**
 * Repository for Organization-related database operations
 */
export class OrganizationRepository {
  /**
   * Create a new organization
   */
  static async create(
    data: Prisma.OrganizationCreateInput,
  ): Promise<Organization> {
    const prisma = getPrisma()
    return prisma.organization.create({ data })
  }

  /**
   * Get organization by ID
   */
  static async getById(id: number): Promise<Organization | null> {
    const prisma = getPrisma()
    return prisma.organization.findUnique({ where: { id } })
  }

  /**
   * Update organization
   */
  static async update(
    id: number,
    data: Prisma.OrganizationUpdateInput,
  ): Promise<Organization> {
    const prisma = getPrisma()
    return prisma.organization.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete organization
   */
  static async delete(id: number): Promise<Organization> {
    const prisma = getPrisma()
    return prisma.organization.delete({ where: { id } })
  }

  /**
   * List all organizations with optional filtering and pagination
   */
  static async list(
    params: {
      where?: Prisma.OrganizationWhereInput
      orderBy?: Prisma.OrganizationOrderByWithRelationInput
      skip?: number
      take?: number
    } = {},
  ) {
    const prisma = getPrisma()
    const { where, orderBy, skip, take } = params
    return prisma.organization.findMany({
      where,
      orderBy,
      skip,
      take,
    })
  }

  /**
   * Get organization by unique identifiers
   */
  static async getUnique(name: string): Promise<Organization | null> {
    const prisma = getPrisma()
    return prisma.organization.findUnique({
      where: {
        githubName: name,
      },
    })
  }
}
