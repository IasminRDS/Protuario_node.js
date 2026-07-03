import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@ApiTags('Autenticação')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autenticar usuário (UC-01).' })
  async login(@Body() dto: LoginDto, @Ip() ip: string) {
    const tokens = await this.authService.login(dto.login, dto.senha, ip);
    return { data: tokens, message: 'Autenticado com sucesso.' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Renovar access token via refresh token.' })
  async refresh(@Body() dto: RefreshDto) {
    const tokens = await this.authService.refresh(dto.refreshToken);
    return { data: tokens, message: 'Token renovado.' };
  }

  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Encerrar sessão (UC-20).' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Ip() ip: string) {
    await this.authService.logout(user.id, ip);
    return { data: null, message: 'Sessão encerrada.' };
  }

  @ApiBearerAuth()
  @Post('change-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Alterar a própria senha (UC-19).' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Ip() ip: string,
  ) {
    await this.authService.changePassword(
      user.id,
      dto.senhaAtual,
      dto.novaSenha,
      ip,
    );
    return { data: null, message: 'Senha alterada com sucesso.' };
  }
}
