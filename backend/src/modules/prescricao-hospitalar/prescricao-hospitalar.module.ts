import { Module } from '@nestjs/common';
import { PrescricaoHospitalarController } from './prescricao-hospitalar.controller';
import { PrescricaoHospitalarService } from './prescricao-hospitalar.service';

@Module({
  controllers: [PrescricaoHospitalarController],
  providers: [PrescricaoHospitalarService],
})
export class PrescricaoHospitalarModule {}
