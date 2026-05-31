from extensions import db
from datetime import datetime

class Regional(db.Model):
    """Representa uma Regional de Saúde (Ex: Macrorregião, DRS, Núcleo)"""
    __tablename__ = 'regionais'

    id = db.Column(db.Integer, primary_key=True)
    nome = db.Column(db.String(150), nullable=False)
    codigo = db.Column(db.String(50), nullable=True) # Ex: MO-01
    uf = db.Column(db.String(2), nullable=True)
    ativo = db.Column(db.Boolean, default=True)

    criado_em = db.Column(db.DateTime, default=datetime.utcnow)

    # Nota: Os relacionamentos com Unidade e User já devem estar sendo 
    # mapeados nesses respectivos models (unidade.py e user.py) através de db.ForeignKey

    def __repr__(self):
        return f'<Regional {self.nome} - {self.uf}>'