import sys
import os
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from sqlalchemy import event
from models.audit_log import AuditLog
from extensions import db

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()

@login_manager.user_loader
def load_user(user_id):
    from models.user import User
    return db.session.get(User, int(user_id))

def init_db(app):
    """
    Inicializa as extensões do banco de dados.
    Nota: A criação de tabelas (db.create_all) e seeds 
    deve ser feita via comandos do Flask-Migrate ou 
    scripts específicos de CLI.
    """
    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)
    
    login_manager.login_view = 'auth.login'
    login_manager.login_message = 'Por favor, faça login para acessar esta página.'
    login_manager.login_message_category = 'warning'

    with app.app_context():
        # Importação necessária para o db.create_all() identificar as tabelas
        import models.user, models.paciente, models.medico, models.unidade, models.atendimento, \
               models.prontuario, models.audit_log, models.agendamento, models.vacina, \
               models.triagem, models.exame, models.encaminhamento, models.medicamento, \
               models.internacao, models.prescricao_hospitalar, models.cirurgia, \
               models.estoque, models.faturamento, models.pronto_socorro, models.regional
        
        db.create_all()
        
        # Chama a função de seed do novo arquivo
        from database.seeds import seed_data
        seed_data()

# Exemplo de hook para monitorar alterações no banco automaticamente
@event.listens_for(db.session, 'before_commit')
def receive_before_commit(session):
    for obj in session.dirty:
        if hasattr(obj, "__tablename__"):
            # Aqui você pode registrar automaticamente toda alteração
            # Log de segurança para compliance
            pass