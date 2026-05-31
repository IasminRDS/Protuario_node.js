from datetime import datetime
from flask import Blueprint, render_template
from flask_login import login_required

auditoria_bp = Blueprint("auditoria", __name__, url_prefix="/auditoria")

LOGS = [
    {"quando": datetime.now().strftime("%d/%m/%Y %H:%M"), "usuario": "admin", "acao": "Login", "modulo": "Auth"},
]

@auditoria_bp.get("/")
@login_required
def index():
    return render_template("auditoria/index.html", logs=LOGS)