from extensions import db
from datetime import datetime


class Atendimento(db.Model):
    __tablename__ = "atendimentos"

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey("pacientes.id"), nullable=False)
    medico_id = db.Column(db.Integer, db.ForeignKey("medicos.id"), nullable=True)
    unidade_id = db.Column(
        db.Integer, db.ForeignKey("unidades_saude.id"), nullable=False
    )

    data_hora = db.Column(db.DateTime, default=datetime.utcnow)
    tipo = db.Column(db.String(50), nullable=False, default="consulta")
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    criado_por = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    unidade = db.relationship("UnidadeSaude", backref="atendimentos")
    prontuario = db.relationship("Prontuario", backref="atendimento", uselist=False)

    def __repr__(self):
        return f"<Atendimento {self.id} - Paciente {self.paciente_id} - Médico {self.medico_id}>"
