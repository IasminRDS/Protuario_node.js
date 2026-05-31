import re
from pathlib import Path
from datetime import datetime

# =========================================================
# Config
# =========================================================
ROOT = Path(__file__).resolve().parents[1]

SCAN_DIRS = ["routes", "services", "utils", "controllers", "models"]
MODELS_DIR = ROOT / "models"
TEMPLATES_DIR = ROOT / "templates"
REPORTS_DIR = ROOT / "reports"

IGNORE_MODEL_FILES = {"__init__.py"}
IGNORE_MODEL_PREFIX = ("__",)

# =========================================================
# Regex
# =========================================================
# imports de models
RE_FROM_MODELS = re.compile(r"from\s+models\.([a-zA-Z0-9_]+)\s+import\s+")
RE_IMPORT_MODELS = re.compile(r"import\s+models\.([a-zA-Z0-9_]+)")
RE_FROM_DOT_MODEL = re.compile(
    r"from\s+\.([a-zA-Z0-9_]+)\s+import\s+"
)  # em models/__init__.py

# classe declarada no model
RE_CLASS_DECL = re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)

# blueprint e rotas
RE_BP_VAR = re.compile(
    r"(?P<var>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*Blueprint\(\s*['\"](?P<name>[^'\"]+)['\"]"
)
RE_ROUTE_DECORATOR = re.compile(
    r"@(?P<var>[A-Za-z_][A-Za-z0-9_]*)\.(?:route|get|post|put|patch|delete)\s*\("
)
RE_DEF = re.compile(r"^\s*def\s+(?P<fn>[A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)

# endpoint em templates: url_for('x.y') ou url_for("x.y")
RE_URL_FOR = re.compile(r"url_for\(\s*['\"]([A-Za-z0-9_]+\.[A-Za-z0-9_]+)['\"]")


# =========================================================
# Helpers
# =========================================================
def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def list_model_modules():
    modules = []
    for p in MODELS_DIR.glob("*.py"):
        if p.name in IGNORE_MODEL_FILES:
            continue
        if any(p.name.startswith(pref) for pref in IGNORE_MODEL_PREFIX):
            continue
        modules.append(p.stem)
    return sorted(modules)


def map_model_to_classes():
    mapping = {}
    for p in MODELS_DIR.glob("*.py"):
        if p.name in IGNORE_MODEL_FILES:
            continue
        txt = read_text(p)
        mapping[p.stem] = RE_CLASS_DECL.findall(txt)
    return mapping


def all_python_files():
    files = []
    for folder in SCAN_DIRS:
        d = ROOT / folder
        if d.exists() and d.is_dir():
            files.extend(d.rglob("*.py"))
    return sorted(set(files))


def all_template_files():
    if not TEMPLATES_DIR.exists():
        return []
    return sorted(TEMPLATES_DIR.rglob("*.html"))


# =========================================================
# Models analysis
# =========================================================
def collect_imported_model_modules(py_files):
    imported = set()
    occurrences = {}  # module -> [files]
    for f in py_files:
        txt = read_text(f)
        mods = set(RE_FROM_MODELS.findall(txt)) | set(RE_IMPORT_MODELS.findall(txt))
        if f == (MODELS_DIR / "__init__.py"):
            mods |= set(RE_FROM_DOT_MODEL.findall(txt))

        for m in mods:
            imported.add(m)
            occurrences.setdefault(m, []).append(str(f.relative_to(ROOT)))
    return imported, occurrences


def collect_class_name_mentions(py_files, model_class_map):
    class_to_mods = {}
    for mod, classes in model_class_map.items():
        for cls in classes:
            class_to_mods.setdefault(cls, set()).add(mod)

    mentioned = set()
    occ = {}  # module -> [files]
    for f in py_files:
        txt = read_text(f)
        for cls, mods in class_to_mods.items():
            if re.search(rf"\b{re.escape(cls)}\b", txt):
                for m in mods:
                    mentioned.add(m)
                    occ.setdefault(m, []).append(str(f.relative_to(ROOT)))
    return mentioned, occ


# =========================================================
# Endpoint/template analysis
# =========================================================
def parse_endpoints_from_route_file(path: Path):
    """
    Heurística:
    - acha variáveis Blueprint: my_bp = Blueprint("nome_bp", ...)
    - acha decorators @my_bp.get(...) / @my_bp.route(...)
    - pega a próxima função def foo(...)
    - endpoint inferido: nome_bp.foo
    """
    txt = read_text(path)
    lines = txt.splitlines()

    bp_var_to_name = {}
    for m in RE_BP_VAR.finditer(txt):
        bp_var_to_name[m.group("var")] = m.group("name")

    endpoints = []
    i = 0
    while i < len(lines):
        line = lines[i]
        mdec = RE_ROUTE_DECORATOR.search(line)
        if mdec:
            bp_var = mdec.group("var")
            bp_name = bp_var_to_name.get(bp_var)
            # procura próximo def
            j = i + 1
            fn_name = None
            while j < len(lines):
                mdef = RE_DEF.match(lines[j])
                if mdef:
                    fn_name = mdef.group("fn")
                    break
                j += 1
            if bp_name and fn_name:
                endpoints.append(
                    {
                        "endpoint": f"{bp_name}.{fn_name}",
                        "route_file": str(path.relative_to(ROOT)),
                    }
                )
            i = j
        i += 1
    return endpoints


def collect_defined_endpoints(py_files):
    defined = []
    for f in py_files:
        # geralmente endpoints ficam em routes, mas varremos todos por segurança
        defined.extend(parse_endpoints_from_route_file(f))
    return defined


def collect_template_url_for_refs(template_files):
    refs = {}  # endpoint -> [template paths]
    for t in template_files:
        txt = read_text(t)
        found = RE_URL_FOR.findall(txt)
        for ep in found:
            refs.setdefault(ep, []).append(str(t.relative_to(ROOT)))
    return refs


# =========================================================
# Report
# =========================================================
def write_report(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main():
    if not MODELS_DIR.exists():
        print("❌ Pasta models/ não encontrada.")
        return

    py_files = all_python_files()
    tpl_files = all_template_files()

    # -------- models --------
    model_modules = set(list_model_modules())
    model_class_map = map_model_to_classes()

    imported_modules, import_occ = collect_imported_model_modules(py_files)
    class_mentioned_modules, class_occ = collect_class_name_mentions(
        py_files, model_class_map
    )

    used_models = (imported_modules | class_mentioned_modules) & model_modules
    maybe_unused_models = sorted(model_modules - used_models)

    # -------- endpoints/templates --------
    defined_eps_raw = collect_defined_endpoints(py_files)
    defined_eps = {x["endpoint"] for x in defined_eps_raw}

    template_refs = collect_template_url_for_refs(tpl_files)
    referenced_eps = set(template_refs.keys())

    # endpoint definido e nunca referenciado em templates
    eps_not_in_templates = sorted(defined_eps - referenced_eps)

    # endpoint referenciado em template e não definido
    eps_missing_definition = sorted(referenced_eps - defined_eps)

    # map endpoint -> route file (for report)
    ep_to_files = {}
    for item in defined_eps_raw:
        ep_to_files.setdefault(item["endpoint"], set()).add(item["route_file"])

    # -------- build report --------
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    lines.append("RELATÓRIO V3 — MODELS + ENDPOINTS + TEMPLATES")
    lines.append(f"Gerado em: {now}")
    lines.append(f"Projeto: {ROOT}")
    lines.append("")
    lines.append(f"Pastas Python varridas: {', '.join(SCAN_DIRS)}")
    lines.append(
        f"Templates varridos: {TEMPLATES_DIR if TEMPLATES_DIR.exists() else '(não encontrado)'}"
    )
    lines.append("")

    lines.append("=== MODELS ENCONTRADOS ===")
    for m in sorted(model_modules):
        classes = ", ".join(model_class_map.get(m, [])) or "(sem classes detectadas)"
        lines.append(f"- {m}.py | classes: {classes}")
    lines.append("")

    lines.append("=== MODELS COM SINAL DE USO ===")
    for m in sorted(used_models):
        lines.append(f"- {m}.py")
        if m in import_occ:
            files = sorted(set(import_occ[m]))
            lines.append(f"  imports em ({len(files)}):")
            for fp in files[:20]:
                lines.append(f"    • {fp}")
            if len(files) > 20:
                lines.append(f"    • ... +{len(files)-20} arquivo(s)")
        if m in class_occ:
            files = sorted(set(class_occ[m]))
            lines.append(f"  menções de classe em ({len(files)}):")
            for fp in files[:20]:
                lines.append(f"    • {fp}")
            if len(files) > 20:
                lines.append(f"    • ... +{len(files)-20} arquivo(s)")
    lines.append("")

    lines.append("=== MODELS POSSIVELMENTE NÃO UTILIZADOS ===")
    if maybe_unused_models:
        for m in maybe_unused_models:
            lines.append(f"- {m}.py")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append("=== ENDPOINTS DEFINIDOS EM PYTHON ===")
    lines.append(f"Total detectado: {len(defined_eps)}")
    for ep in sorted(defined_eps):
        files = sorted(ep_to_files.get(ep, []))
        where = ", ".join(files) if files else "arquivo não identificado"
        lines.append(f"- {ep}  ({where})")
    lines.append("")

    lines.append("=== ENDPOINTS REFERENCIADOS EM TEMPLATES (url_for) ===")
    lines.append(f"Total detectado: {len(referenced_eps)}")
    for ep in sorted(referenced_eps):
        files = sorted(set(template_refs.get(ep, [])))
        lines.append(f"- {ep}")
        for fp in files[:20]:
            lines.append(f"    • {fp}")
        if len(files) > 20:
            lines.append(f"    • ... +{len(files)-20} template(s)")
    lines.append("")

    lines.append("=== ENDPOINTS DEFINIDOS MAS NÃO REFERENCIADOS EM TEMPLATES ===")
    if eps_not_in_templates:
        for ep in eps_not_in_templates:
            lines.append(f"- {ep}")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append(
        "=== ENDPOINTS REFERENCIADOS EM TEMPLATES MAS NÃO DETECTADOS NAS ROTAS ==="
    )
    if eps_missing_definition:
        for ep in eps_missing_definition:
            lines.append(f"- {ep}")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append("=== AVISOS IMPORTANTES ===")
    lines.append("- Heurístico: pode haver falso positivo/negativo.")
    lines.append("- Endpoints podem ser usados fora de templates (redirect, APIs, JS).")
    lines.append("- Models podem ser usados por relacionamento SQLAlchemy por string.")
    lines.append("- Sempre validar com testes e fluxo manual antes de apagar arquivos.")
    lines.append("")

    report_name = f"unused_models_and_templates_report_v3_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    report_path = REPORTS_DIR / report_name
    write_report(report_path, "\n".join(lines))

    print("✅ Análise V3 concluída.")
    print(f"📄 Relatório: {report_path}")
    print("")
    print("Models possivelmente não utilizados:")
    if maybe_unused_models:
        for m in maybe_unused_models:
            print(f"- {m}.py")
    else:
        print("Nenhum.")
    print("")
    print("Endpoints em templates sem definição detectada:")
    if eps_missing_definition:
        for ep in eps_missing_definition:
            print(f"- {ep}")
    else:
        print("Nenhum.")


if __name__ == "__main__":
    main()
