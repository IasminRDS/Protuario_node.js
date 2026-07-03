import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { RawResponse } from '../../shared/decorators/raw-response.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { FhirService } from './fhir.service';

/**
 * Endpoints FHIR R4 (recursos crus, sem envelope). Interoperabilidade SUS-ready.
 */
@ApiTags('FHIR (interoperabilidade)')
@ApiBearerAuth()
@RequirePermissions(Permission.CLINICAL_READ)
@Controller({ path: 'fhir', version: '1' })
export class FhirController {
  constructor(private readonly fhir: FhirService) {}

  @Get('Patient/:id')
  @RawResponse()
  @ApiOperation({ summary: 'FHIR Patient.' })
  patient(@Param('id') id: string) {
    return this.fhir.patient(id);
  }

  @Get('Encounter/:id')
  @RawResponse()
  @ApiOperation({ summary: 'FHIR Encounter.' })
  encounter(@Param('id') id: string) {
    return this.fhir.encounter(id);
  }

  @Get('Encounter/:id/MedicationRequest')
  @RawResponse()
  @ApiOperation({ summary: 'FHIR Bundle de MedicationRequest do atendimento.' })
  medications(@Param('id') id: string) {
    return this.fhir.medicationRequestsByEncounter(id);
  }
}
