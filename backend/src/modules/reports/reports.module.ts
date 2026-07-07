import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsRefreshService } from './reports-refresh.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService, ReportsRefreshService],
})
export class ReportsModule {}
