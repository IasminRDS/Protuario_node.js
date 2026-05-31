from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required

exames_bp = Blueprint("exames", __name__, url_prefix="/exames")

SOLICITACOES = []


@exames_bp.get("/")
@login_required
def index():
    q = (request.args.get("q") or "").strip().lower()
    itens = SOLICITACOES
    if q:
        itens = [
            e for e in SOLICITACOES
            if q in e["paciente"].lower() or q in e["exame"].lower() or q in e["status"].lower()
        ]
    return render_template("exames/index.html", exames=itens, q=q)


@exames_bp.post("/novo")
@login_required
def novo():
    paciente = (request.form.get("paciente") or "").strip()
    exame = (request.form.get("exame") or "").strip()
    prioridade = (request.form.get("prioridade") or "Normal").strip()

    if not paciente or not exame:
        flash("Paciente e exame são obrigatórios.", "warning")
        return redirect(url_for("exames.index"))

    SOLICITACOES.append({
        "id": len(SOLICITACOES) + 1,
        "paciente": paciente,
        "exame": exame,
        "prioridade": prioridade,
        "status": "Pendente",
    })
    flash("Exame solicitado com sucesso.", "success")
    return redirect(url_for("exames.index"))


@exames_bp.post("/status/<int:exame_id>")
@login_required
def alterar_status(exame_id):
    novo_status = (request.form.get("status") or "Pendente").strip()
    for e in SOLICITACOES:
        if e["id"] == exame_id:
            e["status"] = novo_status
            break
    flash("Status atualizado.", "info")
    return redirect(url_for("exames.index"))