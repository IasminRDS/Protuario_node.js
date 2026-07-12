import { Module } from '@nestjs/common';
import { RndsController } from './rnds.controller';
import { RndsService } from './rnds.service';

@Module({
  controllers: [RndsController],
  providers: [RndsService],
})
export class RndsModule {}
