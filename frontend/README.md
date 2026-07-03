# S-PE — Frontend Hospitalar (Next.js 16)

Sistema de Prontuário Eletrônico. **Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4 + Axios + Zustand + React Hook Form + Zod.**

## Rodar

```bash
cd frontend
npm install
npm run dev        # http://localhost:3001  (porta 3001 p/ não colidir com a API em :3000)
```

Login: `admin` / `Admin@123` (o backend precisa estar no ar em `http://localhost:3000` e ter rodado o seed).

Config: `NEXT_PUBLIC_API_URL` (default `http://localhost:3000/api/v1`) em `.env.local`.
O backend deve ter `CORS_ORIGINS=http://localhost:3001` (já é o default do `.env`).

## Arquitetura
```
src/
  app/                      # App Router
    login/                  # público
    (app)/                  # grupo protegido (shell: sidebar + topbar)
      dashboard/ pacientes/[id] triagem/ atendimentos/ prontuario/ prescricao/ auditoria/
  components/ ui/ layout/ clinical/
  services/  api.ts (axios+interceptors) auth/pacientes/atendimento/prontuario/auditoria/clinical
  store/     auth.store.ts (Zustand)
  hooks/ types/ utils/ (rbac, jwt, token-storage, cn)
```

## Autenticação
- Login → tokens em `localStorage` (`token-storage`), sessão reidratada pela store.
- **Axios interceptor**: injeta `Bearer`; em **401** faz **refresh** transparente (single-flight) e, se falhar, limpa e redireciona para `/login`.
- **Proteção de rota**: o layout `(app)` bloqueia e redireciona sem sessão.
- **RBAC de UI**: `utils/rbac.ts` gera a navegação por perfil (o backend é a autoridade real).

## ⚠️ Estado de integração com o backend
| Módulo | Endpoint | Status |
|---|---|---|
| Login / sessão | `/auth/*` | ✅ real |
| Pacientes (lista, busca, cadastro, detalhe) | `/pacientes` | ✅ real |
| Auditoria | `/auditoria` | ✅ real |
| Triagem | `/triagem` | ⏳ **backend ainda não expõe** |
| Atendimento | `/atendimentos` | ⏳ **backend ainda não expõe** |
| Prontuário (timeline) | `/prontuarios/:id` | ⏳ **backend ainda não expõe** |
| Prescrição | `/prescricoes` | ⏳ **backend ainda não expõe** |

As telas clínicas têm formulários reais e chamam o contrato REST previsto; enquanto o
endpoint não existir, retornam erro tratado (nunca dados falsos). Assim que o backend
expuser essas rotas, as telas passam a funcionar sem mudança no frontend.

> Não foi possível compilar/rodar neste ambiente (sem Node). Código escrito conforme os
> guias do Next.js 16 instalado no repositório.
