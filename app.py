import os
from flask import Flask
from dotenv import load_dotenv

# Importa as instâncias das extensões
from extensions import db, csrf, migrate, login_manager
from config import get_config_class

load_dotenv()

def create_app():
    app = Flask(__name__, template_folder="templates", static_folder="static")
    
    # Carrega a configuração dinamicamente
    app.config.from_object(get_config_class())

    # Inicializa Extensões
    db.init_app(app)
    csrf.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    # Registro de Blueprints
    from routes.auth import auth_bp
    from routes.dashboard import dashboard_bp
    from routes.pacientes import pacientes_bp
    from routes.triagem import triagem_bp
    from routes.atendimento import atendimento_bp
    from routes.admin import admin_bp
    from routes.prontuario import prontuario_bp
    from routes.estoque import estoque_bp
    from routes.alertas import alertas_bp
    from routes.agenda import agenda_bp
    from routes.leitos import leitos_bp
    from routes.internacao import internacao_bp
    from routes.pronto_socorro import pronto_socorro_bp
    from routes.exames import exames_bp
    from routes.catalogo_exames import catalogo_exames_bp
    from routes.catalogo_vacinas import catalogo_vacinas_bp
    from routes.backup import backup_bp
    from routes.auditoria import auditoria_bp
    from routes.unidades import unidades_bp
    
    try:
        from routes.importacao import importacao_bp
    except ImportError:
        from routes.importar import importacao_bp

    blueprints = [
        auth_bp, dashboard_bp, pacientes_bp, triagem_bp, atendimento_bp,
        admin_bp, prontuario_bp, estoque_bp, alertas_bp, agenda_bp,
        leitos_bp, internacao_bp, pronto_socorro_bp, exames_bp,
        catalogo_exames_bp, catalogo_vacinas_bp, backup_bp,
        auditoria_bp, unidades_bp, importacao_bp
    ]

    for bp in blueprints:
        app.register_blueprint(bp)

    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))