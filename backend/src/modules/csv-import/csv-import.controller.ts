import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { RequirePermissions } from '../../shared/decorators/require-permissions.decorator';
import { Permission } from '../../shared/rbac/permissions';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { CsvImportService } from './csv-import.service';

@ApiTags('Importação CSV')
@ApiBearerAuth()
@Controller({ path: 'csv', version: '1' })
export class CsvImportController {
  constructor(private readonly service: CsvImportService) {}

  @Post('pacientes/import')
  // patient:create = permissão de escrita de pacientes (o "patients:write" do escopo).
  @RequirePermissions(Permission.PATIENT_CREATE)
  @UseInterceptors(
    FileInterceptor('file', {
      // memoryStorage: arquivo em buffer (limitado a 5MB) — o parsing é feito em
      // STREAM sobre esse buffer; nada é escrito em disco.
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: (_req, file, cb) => {
        const okExt = /\.csv$/i.test(file.originalname);
        const okMime = [
          'text/csv',
          'application/vnd.ms-excel',
          'application/octet-stream',
          'text/plain',
        ].includes(file.mimetype);
        cb(
          okExt && okMime
            ? null
            : new BadRequestException('Envie um arquivo .csv válido.'),
          okExt && okMime,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Importar pacientes em lote via CSV (modo STRICT).' })
  async importPacientes(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.importPacientes(file, user);
    return { data, message: 'Importação processada.' };
  }
}
