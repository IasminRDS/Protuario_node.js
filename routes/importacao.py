import csv
import io
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required

from database.db import db
from models.paciente import Paciente

importacao_bp = Blueprint("importacao", __name__, url_prefix="/importacao")


@importacao_bp.get("/csv")
@login_required
def csv_form():
    return render_template("importacao/csv.html", preview=None, resultado=None)


@importacao_bp.post("/csv")
@login_required
def csv_importar():
    arquivo = request.files.get("arquivo")
    if not arquivo or not arquivo.filename.lower().endswith(".csv"):
        flash("Envie um arquivo CSV válido.", "warning")
        return redirect(url_for("importacao.csv_form"))

    conteudo = arquivo.read().decode("utf-8-sig", errors="ignore")
    reader = csv.DictReader(io.StringIO(conteudo))

    obrigatorios = {"nome"}
    colunas = set(reader.fieldnames or [])
    if not obrigatorios.issubset(colunas):
        flash("CSV precisa ter ao menos a coluna: nome", "danger")
        return redirect(url_for("importacao.csv_form"))

    inseridos = 0
    ignorados = 0
    erros = 0
    preview = []

    for i, row in enumerate(reader, start=1):
        if i <= 10:
            preview.append(row)

        nome = (row.get("nome") or "").strip()
        if not nome:
            ignorados += 1
            continue

        cpf = (row.get("cpf") or "").strip().replace(".", "").replace("-", "")
        cns = (row.get("cns") or "").strip()

        try:
            if cpf:
                if Paciente.query.filter_by(cpf=cpf).first():
                    ignorados += 1
                    continue
            if cns:
                if Paciente.query.filter_by(cns=cns).first():
                    ignorados += 1
                    continue

            p = Paciente(
                nome=nome,
                nome_social=(row.get("nome_social") or "").strip() or None,
                cpf=cpf or None,
                cns=cns or None,
                sexo=(row.get("sexo") or "").strip() or None,
                telefone=(row.get("telefone") or "").strip() or None,
                municipio=(row.get("municipio") or "").strip() or None,
                uf=(row.get("uf") or "").strip() or None,
                ativo=True
            )
            db.session.add(p)
            inseridos += 1
        except Exception:
            erros += 1

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        flash("Erro ao salvar no banco.", "danger")
        return redirect(url_for("importacao.csv_form"))

    resultado = {"inseridos": inseridos, "ignorados": ignorados, "erros": erros, "total_linhas": inseridos + ignorados + erros}
    flash("Importação concluída.", "success")
    return render_template("importacao/csv.html", preview=preview, resultado=resultado)