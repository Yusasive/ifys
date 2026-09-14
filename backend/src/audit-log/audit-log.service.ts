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
