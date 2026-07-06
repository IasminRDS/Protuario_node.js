import { Module } from '@nestjs/common';
import { CirurgiaController } from './cirurgia.controller';
import { CirurgiaService } from './cirurgia.service';

@Module({
  controllers: [CirurgiaController],
  providers: [CirurgiaService],
})
export class CirurgiaModule {}
