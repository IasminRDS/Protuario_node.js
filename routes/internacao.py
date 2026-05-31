from flask import Blueprint, render_template, request, jsonify
from flask_login import login_required, current_user
from sqlalchemy import func
from sqlalchemy import text
from database.db import db
from models.unidade import Unidade
from models.internacao import Setor, Leito

internacao_bp = Blueprint("internacao", __name__, url_prefix="/internacao")


@internacao_bp.route("/leitos", methods=["GET"])
@login_required
def leitos():
    try:
        unidades = Unidade.query.order_by(Unidade.nome.asc()).all()
    except Exception:
        unidades = []

    try:
        setores = Setor.query.order_by(Setor.nome.asc()).all()
    except Exception:
        setores = []

    return render_template("internacao/leitos.html", setores=setores, unidades=unidades)


@internacao_bp.route("/api/leitos", methods=["GET"])
@login_required
def api_listar_leitos():
    try:
        setor_id = request.args.get("setor_id", type=int)

        # Descobre colunas reais da tabela leitos
        cols_info = (
            db.session.execute(text("PRAGMA table_info(leitos)")).mappings().all()
        )
        cols = {c["name"] for c in cols_info}

        tem_ativo = "ativo" in cols
        tem_observacoes = "observacoes" in cols
        tem_setor_id = "setor_id" in cols
        tem_tipo = "tipo" in cols
        tem_status = "status" in cols

        select_cols = ["id", "numero"]
        if tem_setor_id:
            select_cols.append("setor_id")
        if tem_tipo:
            select_cols.append("tipo")
        if tem_status:
            select_cols.append("status")
        if tem_observacoes:
            select_cols.append("observacoes")
        if tem_ativo:
            select_cols.append("ativo")

        sql = f"SELECT {', '.join(select_cols)} FROM leitos"
        where = []
        params = {}

        if tem_ativo:
            where.append("ativo = 1")

        if setor_id and tem_setor_id:
            where.append("setor_id = :setor_id")
            params["setor_id"] = setor_id

        if where:
            sql += " WHERE " + " AND ".join(where)

        sql += " ORDER BY numero ASC"

        rows = db.session.execute(text(sql), params).mappings().all()

        data = []
        for r in rows:
            setor_nome = ""
            sid = r.get("setor_id")
            if sid:
                s = db.session.get(Setor, sid)
                if s:
                    setor_nome = getattr(s, "nome", "") or ""

            data.append(
                {
                    "id": r.get("id"),
                    "numero": r.get("numero", ""),
                    "tipo": r.get("tipo", ""),
                    "status": r.get("status", ""),
                    "setor_id": sid,
                    "setor": setor_nome,
                }
            )

        return jsonify(data), 200

    except Exception as e:
        return jsonify({"ok": False, "erro": f"api_listar_leitos: {str(e)}"}), 500


@internacao_bp.route("/api/leitos", methods=["POST"])
@login_required
def api_criar_leito():
    try:
        data = request.get_json(silent=True) or request.form or {}

        numero = (data.get("numero") or "").strip()
        tipo = (data.get("tipo") or "comum").strip().lower()
        status = (data.get("status") or "livre").strip().lower()
        setor_id_raw = data.get("setor_id")

        if not numero:
            return jsonify({"ok": False, "erro": "Campo 'numero' é obrigatório."}), 400

        try:
            setor_id = (
                int(setor_id_raw) if setor_id_raw not in (None, "", "null") else None
            )
        except Exception:
            setor_id = None

        if not setor_id:
            return (
                jsonify({"ok": False, "erro": "Campo 'setor_id' é obrigatório."}),
                400,
            )

        setor = db.session.get(Setor, setor_id)
        if not setor:
            return jsonify({"ok": False, "erro": "Setor inválido."}), 400

        tipos_permitidos = {"comum", "isolamento", "uti"}
        if tipo not in tipos_permitidos:
            tipo = "comum"

        status_permitidos = {
            "livre",
            "ocupado",
            "reservado",
            "em_higienizacao",
            "interditado",
            "bloqueado",
        }
        if status not in status_permitidos:
            status = "livre"

        # Colunas reais da tabela
        cols_info = (
            db.session.execute(text("PRAGMA table_info(leitos)")).mappings().all()
        )
        cols = {c["name"] for c in cols_info}

        tem_ativo = "ativo" in cols
        tem_setor_id = "setor_id" in cols
        tem_tipo = "tipo" in cols
        tem_status = "status" in cols
        tem_observacoes = "observacoes" in cols

        # Duplicidade por setor + numero
        q_sql = "SELECT id FROM leitos WHERE lower(numero)=lower(:numero)"
        q_params = {"numero": numero}

        if tem_setor_id:
            q_sql += " AND setor_id=:setor_id"
            q_params["setor_id"] = setor_id

        if tem_ativo:
            q_sql += " AND ativo=1"

        existe = db.session.execute(text(q_sql), q_params).first()
        if existe:
            return (
                jsonify(
                    {
                        "ok": False,
                        "erro": "Já existe leito com esse número neste setor.",
                    }
                ),
                400,
            )

        insert_cols = ["numero"]
        insert_vals = [":numero"]
        ins_params = {"numero": numero}

        if tem_setor_id:
            insert_cols.append("setor_id")
            insert_vals.append(":setor_id")
            ins_params["setor_id"] = setor_id

        if tem_tipo:
            insert_cols.append("tipo")
            insert_vals.append(":tipo")
            ins_params["tipo"] = tipo

        if tem_status:
            insert_cols.append("status")
            insert_vals.append(":status")
            ins_params["status"] = status

        if tem_observacoes:
            insert_cols.append("observacoes")
            insert_vals.append(":observacoes")
            ins_params["observacoes"] = ""

        if tem_ativo:
            insert_cols.append("ativo")
            insert_vals.append(":ativo")
            ins_params["ativo"] = 1

        sql_insert = f"""
            INSERT INTO leitos ({', '.join(insert_cols)})
            VALUES ({', '.join(insert_vals)})
        """

        db.session.execute(text(sql_insert), ins_params)
        db.session.commit()

        novo_id = db.session.execute(text("SELECT last_insert_rowid()")).scalar()

        return (
            jsonify(
                {"ok": True, "id": int(novo_id), "msg": "Leito criado com sucesso."}
            ),
            201,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"ok": False, "erro": f"api_criar_leito: {str(e)}"}), 500


@internacao_bp.route("/api/leitos/<int:leito_id>/status", methods=["POST"])
@login_required
def api_status_leito(leito_id):
    try:
        data = request.get_json(silent=True) or request.form or {}
        status = (data.get("status") or "").strip().lower()

        permitidos = {
            "livre",
            "ocupado",
            "reservado",
            "em_higienizacao",
            "interditado",
            "bloqueado",
        }
        if status not in permitidos:
            return jsonify({"ok": False, "erro": "Status inválido."}), 400

        try:
            leito = db.session.get(Leito, leito_id)
        except Exception:
            leito = Leito.query.get(leito_id)

        if not leito:
            return jsonify({"ok": False, "erro": "Leito não encontrado."}), 404

        if hasattr(leito, "ativo") and not leito.ativo:
            return jsonify({"ok": False, "erro": "Leito inativo."}), 400

        leito.status = status
        db.session.commit()

        return jsonify({"ok": True, "msg": "Status atualizado com sucesso."}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"ok": False, "erro": f"api_status_leito: {str(e)}"}), 500
