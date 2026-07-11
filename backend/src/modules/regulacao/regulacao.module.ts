import { Module } from '@nestjs/common';
import { VigilanciaModule } from '../vigilancia/vigilancia.module';
import { RegulacaoController } from './regulacao.controller';
import { RegulacaoService } from './regulacao.service';

@Module({
  imports: [VigilanciaModule], // gancho SINAN (CID do encaminhamento)
  controllers: [RegulacaoController],
  providers: [RegulacaoService],
})
export class RegulacaoModule {}
