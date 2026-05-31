from extensions import db
from datetime import datetime

class AtendimentoPS(db.Model):
    __tablename__ = 'atendimentos_ps'

    id = db.Column(db.Integer, primary_key=True)
    
    # Relacionamentos
    paciente_id = db.Column(db.Integer, db.ForeignKey('pacientes.id'), nullable=False)
    medico_id = db.Column(db.Integer, db.ForeignKey('medicos.id'), nullable=True)
    triagem_id = db.Column(db.Integer, db.ForeignKey('triagens.id'), nullable=True)
    
    # Dados do Atendimento
    motivo_consulta = db.Column(db.Text, nullable=False)
    diagnostico_preliminar = db.Column(db.Text, nullable=True)
    conduta = db.Column(db.Text, nullable=True)
    
    # Status e Tempo
    status = db.Column(db.String(50), default='em_espera') # em_espera, em_atendimento, internado, alta, obito
    data_chegada = db.Column(db.DateTime, default=datetime.utcnow)
    data_atendimento = db.Column(db.DateTime, nullable=True)
    data_liberacao = db.Column(db.DateTime, nullable=True)
    
    # Controle
    criado_por = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    # Relacionamento reverso com o paciente
    paciente = db.relationship('Paciente', backref=db.backref('atendimentos_ps', lazy=True))

    def __repr__(self):
        return f'<AtendimentoPS {self.id} - Status: {self.status}>'