import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  // TRD §9: every manual action that changes money or ticket state is
  // written here with actor, action, target, and timestamp — this is
  // what answers "who marked this as paid and when" during event-week
  // troubleshooting.
  record(params: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadataJson: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
