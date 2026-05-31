from extensions import db
from datetime import datetime

class Medicamento(db.Model):
    __tablename__ = 'medicamentos'

    id = db.Column(db.Integer, primary_key=True)
    nome_generico = db.Column(db.String(150), nullable=False)
    nome_comercial = db.Column(db.String(150), nullable=True)
    classe = db.Column(db.String(100), nullable=True)
    apresentacao = db.Column(db.String(100), nullable=True)
    via_admin = db.Column(db.String(50), nullable=True)
    controlado = db.Column(db.Boolean, default=False)
    lista_rename = db.Column(db.String(10), nullable=True)
    ativo = db.Column(db.Boolean, default=True)

    # Relacionamento com os itens de prescrição
    itens_prescricao = db.relationship('ItemPrescricao', backref='medicamento_referencia', lazy=True)

    def __repr__(self):
        return f'<Medicamento {self.nome_generico}>'


class Prescricao(db.Model):
    __tablename__ = 'prescricoes'

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=False)
    prontuario_id = db.Column(db.Integer, db.ForeignKey('prontuarios.id'), nullable=True)
    medico_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True)
    unidade_id = db.Column(db.Integer, db.ForeignKey('unidades_saude.id'), nullable=True)
    
    tipo = db.Column(db.String(50), default='ambulatorial')
    validade_dias = db.Column(db.Integer, nullable=True)
    observacoes = db.Column(db.Text, nullable=True)
    status = db.Column(db.String(20), default='ativa')
    
    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    # Relacionamento com os Itens da Prescrição
    itens = db.relationship('ItemPrescricao', backref='prescricao', lazy=True, cascade="all, delete-orphan")

    STATUS_LABELS = {
        'ativa': 'Ativa',
        'suspensa': 'Suspensa',
        'concluida': 'Concluída'
    }

    def __repr__(self):
        return f'<Prescricao {self.id} Paciente {self.paciente_id}>'


class ItemPrescricao(db.Model):
    __tablename__ = 'itens_prescricao'

    id = db.Column(db.Integer, primary_key=True)
    prescricao_id = db.Column(db.Integer, db.ForeignKey('prescricoes.id'), nullable=False)
    medicamento_id = db.Column(db.Integer, db.ForeignKey('medicamentos.id'), nullable=True)
    
    nome_livre = db.Column(db.String(150), nullable=True) # Caso o médico digite um remédio que não está no catálogo
    dose = db.Column(db.String(100), nullable=True)
    via = db.Column(db.String(50), nullable=True)
    frequencia = db.Column(db.String(100), nullable=True)
    duracao = db.Column(db.String(100), nullable=True)
    quantidade = db.Column(db.String(50), nullable=True)
    instrucoes = db.Column(db.Text, nullable=True)

    def __repr__(self):
        nome = self.nome_livre if self.nome_livre else f'MedID {self.medicamento_id}'
        return f'<ItemPrescricao {nome}>'