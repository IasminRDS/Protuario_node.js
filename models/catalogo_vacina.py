from extensions import db


class CatalogoVacina(db.Model):
    __tablename__ = "catalogo_vacinas"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    codigo = db.Column(db.String(30), nullable=False, unique=True, index=True)
    doses = db.Column(db.String(80), nullable=True)
    faixa = db.Column(db.String(120), nullable=True)
    ativo = db.Column(db.Boolean, default=True, nullable=False)
