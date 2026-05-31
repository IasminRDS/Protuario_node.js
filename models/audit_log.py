from datetime import datetime
from extensions import db


class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    tabela = db.Column(
        db.String(80), nullable=False, index=True
    )  # ex: users, pacientes
    registro_id = db.Column(
        db.Integer, nullable=True, index=True
    )  # id do registro alvo
    acao = db.Column(
        db.String(40), nullable=False, index=True
    )  # create/update/delete/list_html
    descricao = db.Column(db.Text, nullable=True)  # evitar "detalhe" por enquanto
    usuario_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    ip = db.Column(db.String(64), nullable=True)
    criado_em = db.Column(
        db.DateTime, default=datetime.utcnow, nullable=False, index=True
    )

    usuario = db.relationship("User", backref="logs_auditoria")

    @property
    def detalhe(self):
        # compatibilidade para templates/código antigo que usam log.detalhe
        return self.descricao
