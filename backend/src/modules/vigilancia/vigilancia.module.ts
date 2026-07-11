import { Module } from '@nestjs/common';
import { VigilanciaController } from './vigilancia.controller';
import { VigilanciaService } from './vigilancia.service';

@Module({
  controllers: [VigilanciaController],
  providers: [VigilanciaService],
  exports: [VigilanciaService], // gancho p/ módulos clínicos (internação, regulação)
})
export class VigilanciaModule {}
