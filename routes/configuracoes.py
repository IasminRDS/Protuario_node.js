from flask import Blueprint, render_template, request, flash, redirect, url_for
from flask_login import login_required

configuracoes_bp = Blueprint("configuracoes", __name__, url_prefix="/configuracoes")

CONFIG = {
    "nome_unidade": "UBS Central",
    "uf": "PB",
    "tema": "escuro"
}

@configuracoes_bp.get("/")
@login_required
def index():
    return render_template("configuracoes/index.html", cfg=CONFIG)

@configuracoes_bp.post("/")
@login_required
def salvar():
    CONFIG["nome_unidade"] = (request.form.get("nome_unidade") or CONFIG["nome_unidade"]).strip()
    CONFIG["uf"] = (request.form.get("uf") or CONFIG["uf"]).strip().upper()
    CONFIG["tema"] = (request.form.get("tema") or CONFIG["tema"]).strip()
    flash("Configurações salvas.", "success")
    return redirect(url_for("configuracoes.index"))