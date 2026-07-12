# Teste de carga

Mede latência/throughput dos endpoints de leitura **sob RLS** (cada leitura
abre uma transação curta com o GUC de tenant).

## Rodar
```bash
# servidor precisa estar no ar
node test/load/load-test.mjs
# parametrizável:
CONN=50 DUR=30 PATH_TEST='/vigilancia/notificacoes' node test/load/load-test.mjs
```

## Resultado de referência (dev, 1 Postgres, 20 conexões, 12s, GET /pacientes)
- **~329 req/s** de média; latência **p50 ≈ 49 ms**, p99 ≈ 306 ms.
- O **rate limiter** (`@nestjs/throttler`, 100 req/janela) retorna **429** após
  o limite — proteção anti-sobrecarga funcionando. Para medir throughput bruto,
  eleve `THROTTLE_LIMIT` no ambiente de teste.

## Observação
Números de dev com um único Postgres. Em produção nacional, a escala vem da
arquitetura celular por UF + réplicas HA (ver `ARQUITETURA-SNPE.md`); as
métricas de latência são observáveis em tempo real via Prometheus/Grafana
(`/metrics`).
