import { Module } from '@nestjs/common';
import { CsvImportController } from './csv-import.controller';
import { CsvImportService } from './csv-import.service';
import { BlindIndexService } from '../../infra/crypto/blind-index';

@Module({
  controllers: [CsvImportController],
  providers: [CsvImportService, BlindIndexService],
})
export class CsvImportModule {}
