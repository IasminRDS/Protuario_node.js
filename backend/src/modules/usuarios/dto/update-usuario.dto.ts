import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateUsuarioDto } from './create-usuario.dto';

/**
 * Atualização cadastral: todos os campos opcionais, exceto senha (alterada
 * exclusivamente pelo fluxo /auth/change-password — RN-004).
 */
export class UpdateUsuarioDto extends PartialType(
  OmitType(CreateUsuarioDto, ['senha'] as const),
) {}
