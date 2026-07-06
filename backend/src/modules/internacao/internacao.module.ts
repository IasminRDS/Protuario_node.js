import { Module } from '@nestjs/common';
import { InternacaoController } from './internacao.controller';
import { InternacaoService } from './internacao.service';

@Module({
  controllers: [InternacaoController],
  providers: [InternacaoService],
})
export class InternacaoModule {}
