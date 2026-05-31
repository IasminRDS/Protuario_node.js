from extensions import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    senha_hash = db.Column(db.String(256), nullable=False)

    # perfil funcional (mantido)
    perfil = db.Column(db.String(20), nullable=False, default="recepcionista")
    # admin | medico | enfermeiro | recepcionista

    # vínculo operacional
    unidade_id = db.Column(
        db.Integer, db.ForeignKey("unidades_saude.id"), nullable=True
    )

    # NOVO: nível territorial de acesso
    nivel_acesso = db.Column(db.String(20), nullable=False, default="UNIDADE")
    # ESTADO | REGIONAL | MUNICIPIO | UNIDADE

    # NOVO: escopos territoriais explícitos (opcional para admin global)
    regional_id = db.Column(db.Integer, db.ForeignKey("regionais.id"), nullable=True)
    municipio_ibge = db.Column(db.String(7), nullable=True, index=True)
    uf = db.Column(db.String(2), nullable=True, index=True)

    ativo = db.Column(db.Boolean, default=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)
    ultimo_acesso = db.Column(db.DateTime, nullable=True)

    unidade = db.relationship("UnidadeSaude", backref="users")
    # regional = db.relationship("models.regional.Regional", backref="users")

    def set_password(self, senha):
        self.senha_hash = generate_password_hash(senha)

    def check_password(self, senha):
        return check_password_hash(self.senha_hash, senha)

    def is_medico(self):
        return self.perfil == "medico"

    def is_admin(self):
        return self.perfil == "admin"

    # Helpers territoriais
    def is_estado(self):
        return self.nivel_acesso == "ESTADO"

    def is_regional(self):
        return self.nivel_acesso == "REGIONAL"

    def is_municipio(self):
        return self.nivel_acesso == "MUNICIPIO"

    def is_unidade(self):
        return self.nivel_acesso == "UNIDADE"

    def __repr__(self):
        return f"<User {self.email}>"
