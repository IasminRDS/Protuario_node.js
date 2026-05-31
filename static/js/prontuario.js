/**
 * prontuario.js — Funcionalidades específicas do prontuário
 * Cálculo de IMC, sinais vitais, alertas clínicos
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── Cálculo de IMC em tempo real ──
  const camposPeso   = ['peso', 'altura'].map(id => document.getElementById(id) ||
                        document.querySelector(`[name="${id}"]`)).filter(Boolean);

  function calcularIMC() {
    const peso   = parseFloat(document.querySelector('[name="peso"]')?.value);
    const altura = parseFloat(document.querySelector('[name="altura"]')?.value);
    const divIMC = document.getElementById('imc-display');
    if (!divIMC) return;
    if (peso > 0 && altura > 0) {
      const imc = (peso / (altura * altura)).toFixed(1);
      let classif = '';
      if      (imc < 18.5) classif = '— Abaixo do peso';
      else if (imc < 25)   classif = '— Peso normal';
      else if (imc < 30)   classif = '— Sobrepeso';
      else if (imc < 35)   classif = '— Obesidade Grau I';
      else if (imc < 40)   classif = '— Obesidade Grau II';
      else                 classif = '— Obesidade Grau III';
      divIMC.textContent = `IMC: ${imc} kg/m² ${classif}`;
      divIMC.style.color = (imc >= 18.5 && imc < 25) ? 'var(--sus-verde)' : 'var(--sus-amarelo)';
    } else {
      divIMC.textContent = '';
    }
  }

  camposPeso.forEach(el => el.addEventListener('input', calcularIMC));

  // ── Alertas de sinais vitais fora do range ──
  const alertasSinais = {
    'temperatura':          { min: 35,  max: 37.8, label: 'Temperatura' },
    'frequencia_cardiaca':  { min: 60,  max: 100,  label: 'FC' },
    'frequencia_respiratoria': { min: 12, max: 20, label: 'FR' },
    'saturacao_o2':         { min: 95,  max: 100,  label: 'SpO₂' },
    'glicemia':             { min: 70,  max: 140,  label: 'Glicemia' },
  };

  Object.entries(alertasSinais).forEach(([name, { min, max, label }]) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.addEventListener('input', () => {
      const val = parseFloat(el.value);
      if (!isNaN(val) && (val < min || val > max)) {
        el.style.borderColor = 'var(--sus-vermelho)';
        el.title = `${label} fora do range normal (${min}–${max})`;
      } else {
        el.style.borderColor = '';
        el.title = '';
      }
    });
  });

  // ── Pressão arterial: validar formato 120/80 ──
  const campoPa = document.querySelector('[name="pressao_arterial"]');
  if (campoPa) {
    campoPa.addEventListener('blur', () => {
      const val = campoPa.value.trim();
      if (!val) return;
      if (!/^\d{2,3}\/\d{2,3}$/.test(val)) {
        campoPa.style.borderColor = 'var(--sus-vermelho)';
        campoPa.title = 'Formato esperado: 120/80';
      } else {
        campoPa.style.borderColor = '';
        campoPa.title = '';
        const [sis, dia] = val.split('/').map(Number);
        if (sis >= 180 || dia >= 110) {
          campoPa.style.borderColor = 'var(--sus-vermelho)';
          campoPa.title = '⚠ Hipertensão Grau III — verifique o paciente!';
        }
      }
    });
  }

  // ── Contador de caracteres nos campos SOAP ──
  ['subjetivo', 'objetivo', 'avaliacao', 'plano', 'prescricao', 'encaminhamento'].forEach(name => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    const counter = document.createElement('span');
    counter.style.cssText = 'font-size:.68rem;color:var(--cinza-400);display:block;text-align:right;margin-top:2px';
    el.parentNode.appendChild(counter);
    const update = () => { counter.textContent = `${el.value.length} caracteres`; };
    el.addEventListener('input', update);
    update();
  });

  // ── Confirmar assinatura ──
  const btnAssinar = document.querySelector('[name="assinar"]');
  if (btnAssinar) {
    btnAssinar.closest('form')?.addEventListener('submit', e => {
      if (btnAssinar.closest('form').querySelector('[name="assinar"]:checked') ||
          e.submitter?.name === 'assinar') {
        if (!confirm('Ao assinar, o prontuário ficará bloqueado para edição. Confirmar?')) {
          e.preventDefault();
        }
      }
    });
  }

  // ── Autosave rascunho no localStorage ──
  const form = document.querySelector('form[data-autosave]');
  if (form) {
    const key = `prontuario-rascunho-${form.dataset.autosave}`;

    // Restaurar
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const dados = JSON.parse(saved);
        Object.entries(dados).forEach(([name, value]) => {
          const el = form.querySelector(`[name="${name}"]`);
          if (el && !el.value) el.value = value;
        });
      } catch (_) {}
    }

    // Salvar a cada 30s
    setInterval(() => {
      const dados = {};
      form.querySelectorAll('textarea, input[type="text"], input[type="number"]').forEach(el => {
        if (el.name) dados[el.name] = el.value;
      });
      localStorage.setItem(key, JSON.stringify(dados));
    }, 30000);

    // Limpar após submit
    form.addEventListener('submit', () => localStorage.removeItem(key));
  }

});
