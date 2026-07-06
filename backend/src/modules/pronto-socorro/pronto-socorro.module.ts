import { Module } from '@nestjs/common';
import { ProntoSocorroController } from './pronto-socorro.controller';
import { ProntoSocorroService } from './pronto-socorro.service';

@Module({
  controllers: [ProntoSocorroController],
  providers: [ProntoSocorroService],
})
export class ProntoSocorroModule {}
