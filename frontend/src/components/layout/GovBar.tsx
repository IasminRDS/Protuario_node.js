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
