from datetime import datetime
from extensions import db


class Vacina(db.Model):
    __tablename__ = "vacinas"

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(120), nullable=False)
    
    # NOVAS COLUNAS ADICIONADAS PARA O SEED FUNCIONAR
    sigla = db.Column(db.String(50), nullable=True)
    doses_total = db.Column(db.Integer, default=1)
    intervalo_dias = db.Column(db.Integer, nullable=True)
    
    fabricante = db.Column(db.String(120))
    lote = db.Column(db.String(60))
    validade = db.Column(db.Date)
    ativo = db.Column(db.Boolean, default=True, nullable=False)


class VacinaAplicada(db.Model):
    __tablename__ = "vacinas_aplicadas"

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(
        db.Integer, db.ForeignKey("pacientes.id"), nullable=False, index=True
    )
    vacina_id = db.Column(
        db.Integer, db.ForeignKey("vacinas.id"), nullable=True, index=True
    )

    nome_vacina = db.Column(
        db.String(120), nullable=True
    )  # fallback se não vincular por id
    dose = db.Column(db.String(40), nullable=True)
    data_aplicacao = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    unidade = db.Column(db.String(120), nullable=True)
    profissional = db.Column(db.String(120), nullable=True)
    observacao = db.Column(db.Text, nullable=True)
