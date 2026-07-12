/**
 * Marca do SNPE — cruz da saúde + pulso (linha de ECG), nas cores gov.br.
 * SVG próprio (sem depender de ícone genérico), escalável e nítido.
 */
export function BrandLogo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="SNPE"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="11" fill="#1351b4" />
      {/* cruz da saúde (sutil, ao fundo) */}
      <path
        d="M21 10h6v8h8v6h-8v8h-6v-8h-8v-6h8z"
        fill="#ffffff"
        opacity="0.16"
      />
      {/* linha de pulso (ECG) */}
      <path
        d="M8 25h6l3-8 5 15 4-11 2.5 5H40"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="26" r="2.2" fill="#ffcd07" />
    </svg>
  );
}
