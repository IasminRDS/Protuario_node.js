import { Module } from '@nestjs/common';
import { TerminologiaController } from './terminologia.controller';
import { TerminologiaService } from './terminologia.service';

@Module({
  controllers: [TerminologiaController],
  providers: [TerminologiaService],
  exports: [TerminologiaService], // sumário do paciente decodifica CIDs
})
export class TerminologiaModule {}
