# utils/audit.py
from datetime import datetime
from flask import request
from flask_login import current_user
from functools import wraps
from extensions import db
from models.audit_log import AuditLog

def registrar(tabela, registro_id, acao, detalhes):
    """Função base para registrar o log no banco de dados."""
    usuario_id = getattr(current_user, "id", None) if current_user.is_authenticated else None
    ip = request.headers.get("X-Forwarded-For", request.remote_addr)
    
    try:
        log = AuditLog(
            tabela=tabela,
            registro_id=registro_id,
            acao=acao,
            detalhe=detalhes,
            usuario_id=usuario_id,
            ip=ip,
            criado_em=datetime.utcnow()
        )
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        print(f"[ERRO AUDITORIA]: {e}")
        db.session.rollback()

def audit_log(acao_default="update", tabela_default="desconhecido"):
    """Decorator para registrar ações de auditoria automaticamente (estilo antigo)."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            registro_id = kwargs.get('prontuario_id') or kwargs.get('id')
            registrar(tabela_default, registro_id, acao_default, f"Endpoint: {request.endpoint}")
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_auditoria(tabela, acao):
    """Decorator para registrar ações de auditoria (estilo novo/recomendado)."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Tenta pegar o ID do registro pela rota
            registro_id = kwargs.get('prontuario_id') or request.view_args.get('id')
            # Registra a ação usando a função base
            registrar(tabela, registro_id, acao, f"Acesso à rota: {request.path}")
            return f(*args, **kwargs)
        return decorated_function
    return decorator