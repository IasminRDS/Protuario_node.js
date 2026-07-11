import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../shared/decorators/public.decorator';
import { GovbrService, type GovbrSelo } from './govbr.service';

const SELO_COR: Record<GovbrSelo, string> = {
  ouro: '#d4a017',
  prata: '#8a96a3',
  bronze: '#a97142',
};

@ApiTags('Autenticação gov.br')
@Public()
@Controller({ path: 'auth/govbr', version: '1' })
export class GovbrController {
  constructor(
    private readonly govbr: GovbrService,
    private readonly config: ConfigService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Disponibilidade do login gov.br (para exibir o botão).' })
  status() {
    return {
      data: {
        enabled: this.config.get<boolean>('GOVBR_ENABLED', true),
        simulador: this.config.get<boolean>('GOVBR_SIMULATOR', true),
      },
      message: 'Status gov.br.',
    };
  }

  @Get('login')
  @ApiOperation({ summary: 'Inicia o fluxo OIDC (redireciona ao authorize).' })
  async login(@Res() res: Response): Promise<void> {
    if (!this.config.get<boolean>('GOVBR_ENABLED', true)) {
      throw new BadRequestException('Login gov.br desabilitado.');
    }
    res.redirect(await this.govbr.authorizeUrl());
  }

  @Get('simulador')
  @ApiOperation({ summary: 'IdP simulado (dev): tela de escolha de conta gov.br.' })
  async simulador(@Query('state') state: string, @Res() res: Response): Promise<void> {
    const contas = await this.govbr.contasSimuladas();
    const linhas = await Promise.all(
      contas.map(async (c) => {
        const code = await this.govbr.gerarCodeSimulado(c.id, c.selo, state);
        const href = `/api/v1/auth/govbr/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
        return `
          <a class="conta" href="${href}">
            <span class="nome">${c.nome}</span>
            <span class="perfil">${c.perfil} · ${c.login}</span>
            <span class="selo" style="background:${SELO_COR[c.selo]}">selo ${c.selo}</span>
          </a>`;
      }),
    );

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Entrar com gov.br (simulação)</title>
      <style>
        body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#f8f8f8;margin:0;color:#1c2b39}
        header{background:#071d41;color:#fff;padding:12px 20px;font-weight:700}
        header b{color:#ffcd07}
        main{max-width:460px;margin:32px auto;padding:0 16px}
        h1{font-size:18px}
        .aviso{background:#fff3cd;border:1px solid #ffe69c;color:#664d03;padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:16px}
        .conta{display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid #dde2e8;border-radius:8px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:inherit;position:relative}
        .conta:hover{border-color:#1351b4;box-shadow:0 2px 8px rgba(19,81,180,.12)}
        .nome{font-weight:600}
        .perfil{font-size:12px;color:#5c6b7a}
        .selo{position:absolute;right:12px;top:12px;color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:10px}
      </style></head><body>
      <header>gov<b>.br</b></header>
      <main>
        <h1>Escolha uma conta para entrar</h1>
        <p class="aviso">Ambiente de <strong>simulação</strong> do login gov.br (sem credenciamento). Em produção, esta tela é a do sso.acesso.gov.br.</p>
        ${linhas.join('')}
      </main></body></html>`);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Callback OIDC: conclui o login e volta ao frontend.' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Ip() ip: string,
    @Res() res: Response,
  ): Promise<void> {
    const frontend = this.config.get<string>(
      'GOVBR_FRONTEND_URL',
      'http://localhost:3001/login',
    );
    try {
      const oneTime = await this.govbr.concluirCallback(code, state, ip);
      res.redirect(`${frontend}?govbr=${encodeURIComponent(oneTime)}`);
    } catch {
      res.redirect(`${frontend}?govbr_erro=1`);
    }
  }

  @Post('session')
  @HttpCode(200)
  @ApiOperation({ summary: 'Troca o código de uso único pelos tokens da aplicação.' })
  session(@Body('code') code: string) {
    if (!code) throw new BadRequestException('Código ausente.');
    const tokens = this.govbr.trocarSessao(code);
    return { data: tokens, message: 'Autenticado via gov.br.' };
  }
}
