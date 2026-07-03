import { Global, Module } from '@nestjs/common';
import { PatientFlowService } from './patient-flow.service';

/** Fornece o serviço de FSM do paciente aos módulos clínicos. */
@Global()
@Module({
  providers: [PatientFlowService],
  exports: [PatientFlowService],
})
export class ClinicalModule {}
