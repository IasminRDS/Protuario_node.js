import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { PasswordService } from '../../infra/auth/password.service';
import { TotpService } from '../../infra/auth/totp.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // segredos/expiração definidos por operação no service
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PasswordService, TotpService],
  exports: [AuthService, PasswordService, TotpService],
})
export class AuthModule {}
