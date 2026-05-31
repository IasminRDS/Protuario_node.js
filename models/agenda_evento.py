from extensions import db


class AgendaEvento(db.Model):
    __tablename__ = "agenda_eventos"

    id = db.Column(db.Integer, primary_key=True)
    paciente_nome = db.Column(db.String(160), nullable=False, index=True)
    data = db.Column(db.String(10), nullable=False, index=True)  # YYYY-MM-DD
    hora = db.Column(db.String(5), nullable=False, index=True)  # HH:MM
    tipo = db.Column(db.String(40), nullable=False, default="consulta")
    status = db.Column(db.String(30), nullable=False, default="agendado", index=True)
    observacao = db.Column(db.String(255), nullable=True)
    ativo = db.Column(db.Boolean, default=True, nullable=False, index=True)
