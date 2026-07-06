import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = defineConfig([
  ...nextVitals,
  // Ignores padrão do eslint-config-next (precisam ser redeclarados no flat config).
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    rules: {
      // Rebaixado de erro para aviso: os componentes de busca (usePatients,
      // PatientPicker, auditoria, paciente/[id]) usam fetch-on-dependency dentro
      // de useEffect — padrão legítimo porém sinalizado por esta regra estrita do
      // React 19. Fica visível como aviso até migrarmos o data-fetching para uma
      // camada dedicada (React Query/SWR), sem travar o lint da base existente.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])

export default eslintConfig
