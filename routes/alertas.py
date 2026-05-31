from flask import Blueprint, render_template
from flask_login import login_required

alertas_bp = Blueprint("alertas", __name__, url_prefix="/alertas")


@alertas_bp.get("/")
@login_required
def index():
    alertas = [
        {"tipo": "info", "titulo": "Sistema ativo", "descricao": "Nenhum alerta crítico no momento."},
    ]
    return render_template("alertas/index.html", alertas=alertas)