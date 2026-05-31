"""
models package bootstrap seguro:
- tenta importar módulos/classes comuns
- ignora os que não existem
- monta __all__ automaticamente
- cria aliases de compatibilidade (ex.: Unidade -> UnidadeSaude)
"""

from importlib import import_module

# mapa: modulo -> classes esperadas
_MODEL_IMPORTS = {
    "agendamento": ["Agendamento"],
    "atendimento": ["Atendimento"],
    "encaminhamento": ["Encaminhamento"],
    "estoque": ["ItemEstoque", "MovEstoque", "EstoqueItem"],
    "exame": ["TipoExame", "ExameSolicitado", "Exame"],
    "internacao": ["Setor", "Leito", "Internacao", "EvolucaoInternacao"],
    "medico": ["Medico"],
    "paciente": ["Paciente"],
    "prontuario": ["Prontuario"],
    "regionais": ["Regional"],
    "triagem": ["Triagem"],
    "unidade": ["Unidade"],
    "unidade_saude": ["UnidadeSaude"],
    "user": ["User"],
    "vacina": ["Vacina", "VacinaAplicada"],
    "catalogo_exame": ["CatalogoExame"],
    "catalogo_vacina": ["CatalogoVacina"],
    "audit_log": ["AuditLog"],
}

__all__ = []

for module_name, class_names in _MODEL_IMPORTS.items():
    try:
        mod = import_module(f"{__name__}.{module_name}")
    except Exception:
        continue

    for cls in class_names:
        if hasattr(mod, cls):
            globals()[cls] = getattr(mod, cls)
            if cls not in __all__:
                __all__.append(cls)

# Compatibilidade legada: relationship("Unidade")
if "Unidade" not in globals() and "UnidadeSaude" in globals():
    Unidade = UnidadeSaude
    if "Unidade" not in __all__:
        __all__.append("Unidade")
