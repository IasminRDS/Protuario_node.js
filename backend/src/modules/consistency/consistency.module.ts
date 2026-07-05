import { Module } from '@nestjs/common';
import { ConsistencyMonitorController } from './consistency-monitor.controller';
import { ConsistencyMonitorService } from './consistency-monitor.service';

@Module({
  controllers: [ConsistencyMonitorController],
  providers: [ConsistencyMonitorService],
  exports: [ConsistencyMonitorService],
})
export class ConsistencyModule {}
