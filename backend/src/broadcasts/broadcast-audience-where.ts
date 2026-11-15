import { Prisma } from '../generated/prisma/client';
import { BroadcastAudienceDto } from './dto/broadcast-audience.dto';

export function broadcastAudienceWhere(
  eventId: string,
  audience: BroadcastAudienceDto,
): Prisma.RegistrationWhereInput {
  return audience.registrationIds?.length
    ? { eventId, id: { in: audience.registrationIds } }
    : {
        eventId,
        ...(audience.statuses?.length && {
          status: { in: audience.statuses },
        }),
        ...((audience.categories?.length || audience.tiers?.length) && {
          ticketProduct: {
            ...(audience.categories?.length && {
              category: { in: audience.categories },
            }),
            ...(audience.tiers?.length && { tier: { in: audience.tiers } }),
          },
        }),
      };
}
