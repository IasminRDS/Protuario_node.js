from extensions import db
from datetime import datetime

class PrescricaoHospitalar(db.Model):
    __tablename__ = 'prescricoes_hospitalares'

    id = db.Column(db.Integer, primary_key=True)
    internacao_id = db.Column(db.Integer, db.ForeignKey('internacoes.id'), nullable=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=True)
    medico_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True)

    data_prescricao = db.Column(db.DateTime, default=datetime.utcnow)
    validade_horas = db.Column(db.Integer, default=24)
    observacoes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='ativa') # ativa, finalizada, suspensa

    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    # Relacionamento com os itens da prescrição
    itens = db.relationship('ItemPrescricaoHosp', backref='prescricao_hospitalar', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<PrescricaoHospitalar {self.id}>'


class ItemPrescricaoHosp(db.Model):
    __tablename__ = 'itens_prescricao_hosp'

    id = db.Column(db.Integer, primary_key=True)
    prescricao_hosp_id = db.Column(db.Integer, db.ForeignKey('prescricoes_hospitalares.id'), nullable=False)
    medicamento_id = db.Column(db.Integer, db.ForeignKey('medicamentos.id'), nullable=True)

    nome_livre = db.Column(db.String(150), nullable=True)
    dose = db.Column(db.String(100), nullable=True)
    via = db.Column(db.String(50), nullable=True)
    frequencia = db.Column(db.String(100), nullable=True)
    instrucoes = db.Column(db.Text, nullable=True)

    # Relacionamento com as checagens (administração) da enfermagem
    administracoes = db.relationship('AdministracaoMed', backref='item_prescricao', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<ItemPrescricaoHosp {self.id}>'


class AdministracaoMed(db.Model):
    __tablename__ = 'administracoes_med'

    id = db.Column(db.Integer, primary_key=True)
    item_prescricao_id = db.Column(db.Integer, db.ForeignKey('itens_prescricao_hosp.id'), nullable=False)
    administrado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    data_agendada = db.Column(db.DateTime, nullable=True)
    data_administracao = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(20), default='pendente') # pendente, realizado, recusado, atrasado
    observacoes = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f'<AdministracaoMed {self.id} Status: {self.status}>'