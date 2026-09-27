import { Prisma, PrismaClient } from '@prisma/client'

export type dbTransactionModel = {
  client?: PrismaClient | Prisma.TransactionClient
}

export type dbTransactionClientModel = PrismaClient | Prisma.TransactionClient
