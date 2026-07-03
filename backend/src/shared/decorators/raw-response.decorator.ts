import { SetMetadata } from '@nestjs/common';

export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Marca o endpoint para NÃO envelopar a resposta em { success, data, ... }.
 * Necessário para retornar recursos FHIR crus (compatibilidade R4).
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
