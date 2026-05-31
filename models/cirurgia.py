from extensions import db
from datetime import datetime

class SalaCirurgica(db.Model):
    __tablename__ = 'salas_cirurgicas'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(100), nullable=False)
    tipo = db.Column(db.String(50), nullable=False) # ex: geral, ortopedia, urgencia
    ativa = db.Column(db.Boolean, default=True)

    # Relacionamento com as cirurgias
    cirurgias = db.relationship('Cirurgia', backref='sala', lazy=True)

    def __repr__(self):
        return f'<SalaCirurgica {self.nome}>'


class Cirurgia(db.Model):
    __tablename__ = 'cirurgias'

    id = db.Column(db.Integer, primary_key=True)
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=False)
    medico_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True) # Cirurgião principal
    sala_id = db.Column(db.Integer, db.ForeignKey('salas_cirurgicas.id'), nullable=True)
    internacao_id = db.Column(db.Integer, db.ForeignKey('internacoes.id'), nullable=True)

    descricao = db.Column(db.String(255), nullable=False) # Nome/tipo do procedimento
    status = db.Column(db.String(20), default='agendada') # agendada, em_andamento, concluida, cancelada
    
    data_agendada = db.Column(db.DateTime, nullable=True)
    data_inicio = db.Column(db.DateTime, nullable=True)
    data_fim = db.Column(db.DateTime, nullable=True)
    
    observacoes = db.Column(db.Text, nullable=True)
    
    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Cirurgia {self.id} Status: {self.status}>'