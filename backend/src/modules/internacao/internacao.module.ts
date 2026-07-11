import { Module } from '@nestjs/common';
import { VigilanciaModule } from '../vigilancia/vigilancia.module';
import { InternacaoController } from './internacao.controller';
import { InternacaoService } from './internacao.service';

@Module({
  imports: [VigilanciaModule], // gancho SINAN (CID de admissão/alta)
  controllers: [InternacaoController],
  providers: [InternacaoService],
})
export class InternacaoModule {}
