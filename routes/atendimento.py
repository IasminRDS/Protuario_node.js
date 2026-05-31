from flask import Blueprint, request, jsonify
from models.atendimento import Atendimento
from database.db import db

atendimento_bp = Blueprint('atendimento', __name__)

@atendimento_bp.route("/atendimento", methods=["POST"])
def criar_atendimento():
    data = request.json

    atendimento = Atendimento(
        paciente_id=data["paciente_id"],
        medico_id=data["medico_id"],
        data=data["data"]
    )

    db.session.add(atendimento)
    db.session.commit()

    return jsonify({"msg": "Atendimento criado"})