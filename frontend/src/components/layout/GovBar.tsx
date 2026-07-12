import { ThemeToggle } from './ThemeToggle';

/**
 * Barra gov.br (Padrão Digital de Governo): faixa institucional no topo de
 * todas as páginas, com a assinatura "gov.br", links padrão do governo
 * federal e o alternador de tema claro/escuro.
 */
export function GovBar() {
  return (
    <div className="bg-govbr-blue-dark text-white">
      <div className="mx-auto flex h-8 max-w-screen-2xl items-center justify-between px-4 text-xs">
        <span className="font-bold tracking-tight">
          gov<span className="text-govbr-yellow">.br</span>
        </span>
        <div className="flex items-center gap-4">
          <nav aria-label="Links institucionais" className="flex gap-4">
            <a
              className="hover:underline"
              href="https://www.gov.br/pt-br/orgaos-do-governo"
              target="_blank"
              rel="noreferrer"
            >
              Órgãos do Governo
            </a>
            <a
              className="hover:underline"
              href="https://www.gov.br/acessoainformacao"
              target="_blank"
              rel="noreferrer"
            >
              Acesso à Informação
            </a>
            <a
              className="hidden hover:underline sm:inline"
              href="https://www.gov.br/governodigital/pt-br/acessibilidade-digital"
              target="_blank"
              rel="noreferrer"
            >
              Acessibilidade
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}

/** Rodapé institucional (DSGov): identifica o órgão responsável pelo sistema. */
export function GovFooter() {
  return (
    <footer className="border-t border-slate-200 bg-govbr-blue-dark px-4 py-3 text-center text-[11px] text-slate-300">
      <p>
        <span className="font-semibold text-white">SNPE</span> — Sistema Nacional de
        Prontuário Eletrônico · Ministério da Saúde (ambiente de desenvolvimento)
      </p>
      <p className="mt-0.5">
        Acesso auditado (LGPD) — todas as consultas a prontuário são registradas.
      </p>
    </footer>
  );
}

const APP_VERSAO = 'v1.4.0-dev';

/**
 * Rodapé da área logada (DSGov): versão do sistema, mapa do site (Sobre) e
 * base legal — presença institucional esperada em sistema de governo.
 */
export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-2.5 text-[11px] text-slate-400">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-2">
        <span>
          SNPE · Sistema Nacional de Prontuário Eletrônico —{' '}
          <span className="font-mono">{APP_VERSAO}</span>
        </span>
        <nav aria-label="Rodapé" className="flex flex-wrap gap-x-4 gap-y-1">
          <a href="/sobre" className="hover:text-clinic-primary hover:underline">
            Sobre o sistema
          </a>
          <a
            href="https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"
            target="_blank"
            rel="noreferrer"
            className="hover:text-clinic-primary hover:underline"
          >
            LGPD (Lei 13.709/2018)
          </a>
          <a
            href="https://www.gov.br/governodigital/pt-br/acessibilidade-digital"
            target="_blank"
            rel="noreferrer"
            className="hover:text-clinic-primary hover:underline"
          >
            Acessibilidade (eMAG)
          </a>
        </nav>
      </div>
    </footer>
  );
}
