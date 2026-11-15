import { Category } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CategoryAvailability {
  category: Category;
  capacity: number;
  soldCount: number;
  remaining: number;
  soldOut: boolean;
}

export function countTicketsSold(
  prisma: PrismaService,
  eventId: string,
  category: Category,
): Promise<number> {
  return prisma.order.count({
    where: {
      status: 'paid',
      registration: { eventId, ticketProduct: { category } },
    },
  });
}

export async function getCategoryAvailability(
  prisma: PrismaService,
  eventId: string,
): Promise<CategoryAvailability[]> {
  const capacities = await prisma.categoryCapacity.findMany({
    where: { eventId },
  });
  return Promise.all(
    capacities.map(async ({ category, capacity }) => {
      const soldCount = await countTicketsSold(prisma, eventId, category);
      const remaining = Math.max(0, capacity - soldCount);
      return {
        category,
        capacity,
        soldCount,
        remaining,
        soldOut: remaining === 0,
      };
    }),
  );
}
