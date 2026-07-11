import { Module } from '@nestjs/common';
import { EpidemiologiaController } from './epidemiologia.controller';
import { EpidemiologiaService } from './epidemiologia.service';

@Module({
  controllers: [EpidemiologiaController],
  providers: [EpidemiologiaService],
})
export class EpidemiologiaModule {}
