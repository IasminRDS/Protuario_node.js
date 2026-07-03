import { ForbiddenException, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { currentHospitalId } from '../../shared/tenant/tenant-context';

const TTL_MS = 30_000; // 30s; heartbeat renova

interface Actor {
  id: string;
  login: string;
}

@Injectable()
export class LocksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Adquire ou identifica o detentor do lock (soft-lock com TTL). */
  async acquire(resource: string, resourceId: string, actor: Actor) {
    const holderId = BigInt(actor.id);
    const expiresAt = new Date(Date.now() + TTL_MS);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.resourceLock.findUnique({
        where: { uq_lock_resource: { resource, resourceId } },
      });

      if (existing) {
        const active = existing.expiresAt.getTime() > Date.now();
        const mine = existing.holderId === holderId;
        if (active && !mine) {
          return {
            acquired: false,
            lockId: existing.id,
            holder: existing.holderName,
            expiresAt: existing.expiresAt,
          };
        }
        const updated = await tx.resourceLock.update({
          where: { id: existing.id },
          data: { holderId, holderName: actor.login, expiresAt },
        });
        return {
          acquired: true,
          lockId: updated.id,
          holder: actor.login,
          expiresAt,
        };
      }

      const created = await tx.resourceLock.create({
        data: {
          id: uuidv7(),
          resource,
          resourceId,
          holderId,
          holderName: actor.login,
          expiresAt,
          hospitalId: currentHospitalId(),
        },
      });
      return { acquired: true, lockId: created.id, holder: actor.login, expiresAt };
    });
  }

  async heartbeat(lockId: string, actor: Actor) {
    const lock = await this.prisma.resourceLock.findUnique({ where: { id: lockId } });
    if (!lock || lock.holderId !== BigInt(actor.id)) {
      throw new ForbiddenException('Lock inexistente ou de outro detentor.');
    }
    await this.prisma.resourceLock.update({
      where: { id: lockId },
      data: { expiresAt: new Date(Date.now() + TTL_MS) },
    });
    return { renewed: true };
  }

  async release(lockId: string, actor: Actor) {
    const lock = await this.prisma.resourceLock.findUnique({ where: { id: lockId } });
    if (lock && lock.holderId === BigInt(actor.id)) {
      await this.prisma.resourceLock.delete({ where: { id: lockId } });
    }
    return { released: true };
  }

  async holder(resource: string, resourceId: string) {
    const lock = await this.prisma.resourceLock.findUnique({
      where: { uq_lock_resource: { resource, resourceId } },
    });
    const active = lock && lock.expiresAt.getTime() > Date.now();
    return { holder: active ? lock!.holderName : null };
  }
}
