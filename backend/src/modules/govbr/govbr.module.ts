import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { GovbrController } from './govbr.controller';
import { GovbrService } from './govbr.service';

@Module({
  imports: [JwtModule.register({}), AuthModule],
  controllers: [GovbrController],
  providers: [GovbrService],
})
export class GovbrModule {}
