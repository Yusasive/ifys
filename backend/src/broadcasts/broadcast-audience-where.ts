import { Prisma } from '../generated/prisma/client';
import { BroadcastAudienceDto } from './dto/broadcast-audience.dto';

// The registrations a broadcast audience selects. Shared by sending and by
// the WhatsApp-invite tracking, which works out who earlier WhatsApp
// broadcasts went to from their stored audienceJson.
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
