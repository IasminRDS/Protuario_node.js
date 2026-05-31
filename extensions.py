# extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from flask_migrate import Migrate
from flask_login import LoginManager

db = SQLAlchemy()
csrf = CSRFProtect()
migrate = Migrate()
login_manager = LoginManager()

# --- ADICIONE ESTA PARTE ---
from models.user import User # Importe seu model de Usuário aqui

@login_manager.user_loader
def load_user(user_id):
    # O Flask-Login chama essa função para carregar o usuário da sessão
    return User.query.get(int(user_id))