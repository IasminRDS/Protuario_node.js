import re
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parents[1]
MODELS_DIR = ROOT / "models"
TEMPLATES_DIR = ROOT / "templates"
REPORTS_DIR = ROOT / "reports"

# pastas/arquivos ignorados no scan global
EXCLUDE_DIRS = {
    ".git", "venv", ".venv", "__pycache__", ".mypy_cache", ".pytest_cache",
    "node_modules", "dist", "build", "site-packages", ".idea", ".vscode"
}
EXCLUDE_FILE_SUFFIX = {".pyc", ".pyo", ".log"}
EXCLUDE_FILENAMES = {"Thumbs.db", ".DS_Store"}

IGNORE_MODEL_FILES = {"__init__.py"}

# regex
RE_FROM_MODELS = re.compile(r"from\s+models\.([a-zA-Z0-9_]+)\s+import\s+")
RE_IMPORT_MODELS = re.compile(r"import\s+models\.([a-zA-Z0-9_]+)")
RE_FROM_DOT_MODEL = re.compile(r"from\s+\.([a-zA-Z0-9_]+)\s+import\s+")
RE_CLASS_DECL = re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)

RE_BP_VAR = re.compile(r"(?P<var>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*Blueprint\(\s*['\"](?P<name>[^'\"]+)['\"]")
RE_ROUTE_DEC = re.compile(r"@(?P<var>[A-Za-z_][A-Za-z0-9_]*)\.(?:route|get|post|put|patch|delete)\s*\(")
RE_DEF = re.compile(r"^\s*def\s+(?P<fn>[A-Za-z_][A-Za-z0-9_]*)\s*\(", re.MULTILINE)
RE_URL_FOR = re.compile(r"url_for\(\s*['\"]([A-Za-z0-9_]+\.[A-Za-z0-9_]+)['\"]")


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def is_excluded(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if path.name in EXCLUDE_FILENAMES:
        return True
    if path.suffix.lower() in EXCLUDE_FILE_SUFFIX:
        return True
    return False


def all_files():
    files = []
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        if is_excluded(p):
            continue
        files.append(p)
    return files


def all_python_files(files):
    return [f for f in files if f.suffix.lower() == ".py"]


def all_template_files(files):
    # full scan: qualquer html no projeto
    return [f for f in files if f.suffix.lower() == ".html"]


def list_model_modules():
    if not MODELS_DIR.exists():
        return []
    out = []
    for p in MODELS_DIR.glob("*.py"):
        if p.name in IGNORE_MODEL_FILES:
            continue
        out.append(p.stem)
    return sorted(out)


def map_model_to_classes():
    mapping = {}
    if not MODELS_DIR.exists():
        return mapping
    for p in MODELS_DIR.glob("*.py"):
        if p.name in IGNORE_MODEL_FILES:
            continue
        mapping[p.stem] = RE_CLASS_DECL.findall(read_text(p))
    return mapping


def collect_model_imports(py_files):
    imported = set()
    occ = {}
    for f in py_files:
        txt = read_text(f)
        mods = set(RE_FROM_MODELS.findall(txt)) | set(RE_IMPORT_MODELS.findall(txt))
        if f == (MODELS_DIR / "__init__.py"):
            mods |= set(RE_FROM_DOT_MODEL.findall(txt))
        for m in mods:
            imported.add(m)
            occ.setdefault(m, []).append(str(f.relative_to(ROOT)))
    return imported, occ


def collect_class_mentions(py_files, model_class_map):
    class_to_mods = {}
    for mod, classes in model_class_map.items():
        for cls in classes:
            class_to_mods.setdefault(cls, set()).add(mod)

    mentioned = set()
    occ = {}
    for f in py_files:
        txt = read_text(f)
        for cls, mods in class_to_mods.items():
            if re.search(rf"\b{re.escape(cls)}\b", txt):
                for m in mods:
                    mentioned.add(m)
                    occ.setdefault(m, []).append(str(f.relative_to(ROOT)))
    return mentioned, occ


def parse_endpoints_from_py(path: Path):
    txt = read_text(path)
    lines = txt.splitlines()

    bp_var_to_name = {}
    for m in RE_BP_VAR.finditer(txt):
        bp_var_to_name[m.group("var")] = m.group("name")

    endpoints = []
    i = 0
    while i < len(lines):
        mdec = RE_ROUTE_DEC.search(lines[i])
        if mdec:
            bp_var = mdec.group("var")
            bp_name = bp_var_to_name.get(bp_var)
            j = i + 1
            fn = None
            while j < len(lines):
                mdef = RE_DEF.match(lines[j])
                if mdef:
                    fn = mdef.group("fn")
                    break
                j += 1
            if bp_name and fn:
                endpoints.append({"endpoint": f"{bp_name}.{fn}", "file": str(path.relative_to(ROOT))})
            i = j
        i += 1
    return endpoints


def collect_defined_endpoints(py_files):
    out = []
    for f in py_files:
        out.extend(parse_endpoints_from_py(f))
    return out


def collect_template_endpoints(template_files):
    refs = {}
    for t in template_files:
        txt = read_text(t)
        for ep in RE_URL_FOR.findall(txt):
            refs.setdefault(ep, []).append(str(t.relative_to(ROOT)))
    return refs


def write_report(text: str):
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    name = f"fullscan_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    path = REPORTS_DIR / name
    path.write_text(text, encoding="utf-8")
    return path


def main():
    if not MODELS_DIR.exists():
        print("❌ Pasta models/ não encontrada.")
        return

    files = all_files()
    py_files = all_python_files(files)
    html_files = all_template_files(files)

    models = set(list_model_modules())
    model_class_map = map_model_to_classes()

    imported, import_occ = collect_model_imports(py_files)
    mentioned, mention_occ = collect_class_mentions(py_files, model_class_map)

    used_models = (imported | mentioned) & models
    maybe_unused = sorted(models - used_models)

    defined_eps_raw = collect_defined_endpoints(py_files)
    defined_eps = {x["endpoint"] for x in defined_eps_raw}
    ep_files = {}
    for e in defined_eps_raw:
        ep_files.setdefault(e["endpoint"], set()).add(e["file"])

    tpl_refs = collect_template_endpoints(html_files)
    tpl_eps = set(tpl_refs.keys())

    eps_not_in_templates = sorted(defined_eps - tpl_eps)
    eps_missing_definition = sorted(tpl_eps - defined_eps)

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    lines.append("RELATÓRIO FULL SCAN — MODELS + ENDPOINTS + TEMPLATES")
    lines.append(f"Gerado em: {now}")
    lines.append(f"Projeto: {ROOT}")
    lines.append(f"Arquivos varridos: {len(files)}")
    lines.append(f"Python varridos: {len(py_files)}")
    lines.append(f"HTML varridos: {len(html_files)}")
    lines.append(f"Excluídos por regra: {', '.join(sorted(EXCLUDE_DIRS))}")
    lines.append("")

    lines.append("=== MODELS ENCONTRADOS ===")
    for m in sorted(models):
        classes = ", ".join(model_class_map.get(m, [])) or "(sem classes)"
        lines.append(f"- {m}.py | classes: {classes}")
    lines.append("")

    lines.append("=== MODELS POSSIVELMENTE NÃO UTILIZADOS ===")
    if maybe_unused:
        for m in maybe_unused:
            lines.append(f"- {m}.py")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append("=== ENDPOINTS DEFINIDOS ===")
    for ep in sorted(defined_eps):
        where = ", ".join(sorted(ep_files.get(ep, [])))
        lines.append(f"- {ep} ({where})")
    lines.append("")

    lines.append("=== ENDPOINTS REFERENCIADOS EM TEMPLATES ===")
    for ep in sorted(tpl_eps):
        refs = ", ".join(sorted(set(tpl_refs.get(ep, []))))
        lines.append(f"- {ep} ({refs})")
    lines.append("")

    lines.append("=== DEFINIDOS MAS NÃO REFERENCIADOS EM TEMPLATE ===")
    if eps_not_in_templates:
        for ep in eps_not_in_templates:
            lines.append(f"- {ep}")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append("=== REFERENCIADOS EM TEMPLATE MAS NÃO DEFINIDOS ===")
    if eps_missing_definition:
        for ep in eps_missing_definition:
            lines.append(f"- {ep}")
    else:
        lines.append("Nenhum.")
    lines.append("")

    lines.append("=== AVISOS ===")
    lines.append("- Heurístico: pode ter falso positivo/negativo.")
    lines.append("- Endpoint pode ser usado via redirect/API/JS sem aparecer em template.")
    lines.append("- Model pode ser usado indiretamente por SQLAlchemy string relationship.")
    lines.append("- Sempre valide com testes e fluxo manual antes de apagar.")
    lines.append("")

    report_path = write_report("\n".join(lines))
    print("✅ Full scan concluído.")
    print(f"📄 Relatório: {report_path}")
    print("\nModels possivelmente não utilizados:")
    if maybe_unused:
        for m in maybe_unused:
            print(f"- {m}.py")
    else:
        print("Nenhum.")


if __name__ == "__main__":
    main()