import { Module } from '@nestjs/common';
import { LocksController } from './locks.controller';
import { LocksService } from './locks.service';

@Module({
  controllers: [LocksController],
  providers: [LocksService],
})
export class LocksModule {}
