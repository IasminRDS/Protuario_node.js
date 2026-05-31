from extensions import db
from datetime import datetime

class AIH(db.Model):
    """Autorização de Internação Hospitalar"""
    __tablename__ = 'faturamento_aih'

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=False)
    internacao_id = db.Column(db.Integer, db.ForeignKey('internacoes.id'), nullable=True)
    medico_solicitante_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True)

    numero_aih = db.Column(db.String(20), unique=True, nullable=True)
    procedimento_principal = db.Column(db.String(255), nullable=False)
    cid_principal = db.Column(db.String(10), nullable=True)

    data_emissao = db.Column(db.Date, default=datetime.utcnow)
    data_apresentacao = db.Column(db.Date, nullable=True)
    
    valor_total = db.Column(db.Numeric(10, 2), nullable=True)
    status = db.Column(db.String(20), default='aberta') # aberta, faturada, rejeitada, cancelada
    
    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<AIH {self.numero_aih} - Status: {self.status}>'


class APAC(db.Model):
    """Autorização de Procedimentos Ambulatoriais de Alta Complexidade"""
    __tablename__ = 'faturamento_apac'

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=False)
    medico_solicitante_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True)

    numero_apac = db.Column(db.String(20), unique=True, nullable=True)
    procedimento_principal = db.Column(db.String(255), nullable=False)
    cid_principal = db.Column(db.String(10), nullable=True)

    data_inicio_validade = db.Column(db.Date, nullable=False)
    data_fim_validade = db.Column(db.Date, nullable=False)
    
    quantidade_aprovada = db.Column(db.Integer, default=1)
    quantidade_realizada = db.Column(db.Integer, default=0)

    valor_total = db.Column(db.Numeric(10, 2), nullable=True)
    status = db.Column(db.String(20), default='ativa') # ativa, encerrada, cancelada

    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<APAC {self.numero_apac} - Status: {self.status}>'