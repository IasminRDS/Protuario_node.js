from extensions import db
from datetime import datetime


class Agendamento(db.Model):
    __tablename__ = "agendamentos"

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey("pacientes.id"), nullable=False)
    medico_id = db.Column(db.Integer, db.ForeignKey("medicos.id"), nullable=True)
    unidade_id = db.Column(
        db.Integer, db.ForeignKey("unidades_saude.id"), nullable=False
    )  # <- aqui
    criado_por = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    data_hora = db.Column(db.DateTime, nullable=False)
    tipo = db.Column(db.String(30), default="consulta")

    status = db.Column(db.String(20), default="agendado")

    observacoes = db.Column(db.Text, nullable=True)
    motivo_cancel = db.Column(db.String(200), nullable=True)

    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    atualizado_em = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    paciente = db.relationship("Paciente", backref="agendamentos")
    medico = db.relationship("Medico", backref="agendamentos")
    unidade = db.relationship("UnidadeSaude", backref="agendamentos")
