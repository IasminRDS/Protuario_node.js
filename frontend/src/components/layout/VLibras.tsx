'use client';

import { useEffect } from 'react';

/**
 * VLibras — tradutor de Libras oficial do Governo Federal (acessibilidade
 * eMAG/LBI). Carrega o plugin de vlibras.gov.br e inicializa o widget uma vez.
 */
export function VLibras() {
  useEffect(() => {
    if (document.getElementById('vlibras-plugin-script')) return;

    const script = document.createElement('script');
    script.id = 'vlibras-plugin-script';
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.async = true;
    script.onload = () => {
      const w = window as unknown as {
        VLibras?: { Widget: new (url: string) => void };
      };
      if (w.VLibras) new w.VLibras.Widget('https://vlibras.gov.br/app');
    };
    document.body.appendChild(script);
  }, []);

  // Atributos não-padrão exigidos pelo plugin VLibras (vw, vw-access-button…)
  // passados via spread para não conflitar com a tipagem JSX.
  return (
    <div {...{ vw: '' }} className="enabled">
      <div {...{ 'vw-access-button': '' }} className="active" />
      <div {...{ 'vw-plugin-wrapper': '' }}>
        <div className="vw-plugin-top-wrapper" />
      </div>
    </div>
  );
}
