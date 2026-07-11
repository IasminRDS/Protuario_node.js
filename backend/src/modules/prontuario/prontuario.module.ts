import { Module } from '@nestjs/common';
import { TerminologiaModule } from '../terminologia/terminologia.module';
import { ProntuarioController } from './prontuario.controller';
import { ProntuarioService } from './prontuario.service';

@Module({
  imports: [TerminologiaModule], // decodificação de CID no sumário/timeline
  controllers: [ProntuarioController],
  providers: [ProntuarioService],
})
export class ProntuarioModule {}
