from flask import Blueprint, render_template
from flask_login import login_required

# Alertas
alertas_bp = Blueprint("alertas", __name__, url_prefix="/alertas")
@alertas_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Alertas")


# Agenda
agenda_bp = Blueprint("agenda", __name__, url_prefix="/agenda")
@agenda_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Agenda")


# Pronto-Socorro
pronto_socorro_bp = Blueprint("pronto_socorro", __name__, url_prefix="/pronto-socorro")
@pronto_socorro_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Pronto-Socorro")


# Leitos (Internação + Centro Cirúrgico)
leitos_bp = Blueprint("leitos", __name__, url_prefix="/leitos")
@leitos_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Leitos")


# Exames
exames_bp = Blueprint("exames", __name__, url_prefix="/exames")
@exames_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Exames")


# Catálogo de Exames
catalogo_exames_bp = Blueprint("catalogo_exames", __name__, url_prefix="/catalogo-exames")
@catalogo_exames_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Catálogo de Exames")


# Catálogo de Vacinas
catalogo_vacinas_bp = Blueprint("catalogo_vacinas", __name__, url_prefix="/catalogo-vacinas")
@catalogo_vacinas_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Catálogo de Vacinas")


# Importação CSV
importacao_bp = Blueprint("importacao", __name__, url_prefix="/importacao")
@importacao_bp.get("/csv")
@login_required
def csv():
    return render_template("placeholders/simple_page.html", titulo="Importar Pacientes via CSV")


# Backup
backup_bp = Blueprint("backup", __name__, url_prefix="/backup")
@backup_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Backup")


# Configurações
configuracoes_bp = Blueprint("configuracoes", __name__, url_prefix="/configuracoes")
@configuracoes_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Configurações")


# Auditoria
auditoria_bp = Blueprint("auditoria", __name__, url_prefix="/auditoria")
@auditoria_bp.get("/")
@login_required
def index():
    return render_template("placeholders/simple_page.html", titulo="Log de Auditoria")