import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log.query';

export interface ActorSummary {
  id: string;
  name: string;
  email: string;
  role: string;
}

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

  // System-wide read: any actor, any target, filterable by action/actor/date
  // range. Restricted to super_admin at the controller level — this is
  // meant for org-wide oversight, not something every admin should see.
  async listSystemWide(query: ListAuditLogQueryDto) {
    const where = this.buildWhere(query);

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    const actorsById = await this.resolveActors(entries.map((e) => e.actorId));

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      entries: entries.map((entry) => ({
        ...entry,
        actor: actorsById[entry.actorId] ?? null,
      })),
    };
  }

  // Personal read: "my activity". actorId always comes from the
  // authenticated session (the controller passes req.user.sub here) — we
  // deliberately never read query.actorId in this method. Trusting a
  // client-supplied actorId for a "my own activity" endpoint would let any
  // authenticated user (including door_staff) page through anyone else's
  // audit history just by overriding a query param.
  async listForActor(actorId: string, query: ListAuditLogQueryDto) {
    const where = this.buildWhere({ ...query, actorId: undefined }, actorId);

    const [total, entries] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return {
      total,
      page: query.page,
      pageSize: query.pageSize,
      entries,
    };
  }

  private buildWhere(query: ListAuditLogQueryDto, forcedActorId?: string) {
    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    return {
      ...(query.action && { action: query.action }),
      ...(forcedActorId
        ? { actorId: forcedActorId }
        : query.actorId
          ? { actorId: query.actorId }
          : {}),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to }),
        },
      }),
    };
  }

  private async resolveActors(
    actorIds: string[],
  ): Promise<Record<string, ActorSummary>> {
    const distinctIds = Array.from(new Set(actorIds));
    if (distinctIds.length === 0) return {};

    const actors = await this.prisma.adminUser.findMany({
      where: { id: { in: distinctIds } },
      select: { id: true, name: true, email: true, role: true },
    });

    return Object.fromEntries(actors.map((a) => [a.id, a]));
  }
}
