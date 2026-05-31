import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "t", "yes", "y", "on"}

def _to_int(value: str | None, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default

class Config:
    # Flask / Segurança
    SECRET_KEY = os.getenv("SECRET_KEY", "chave-secreta-prontuario-estadual-super-segura")
    WTF_CSRF_ENABLED = _to_bool(os.getenv("WTF_CSRF_ENABLED"), True)
    
    # Segurança de Cookies
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SECURE = False
    SESSION_COOKIE_SAMESITE = "Lax"

    # Banco de Dados
    DEFAULT_DB_URL = "postgresql://postgres:admin@localhost:5432/prontuario_db"
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": _to_int(os.getenv("DB_POOL_RECYCLE"), 1800),
        "pool_size": _to_int(os.getenv("DB_POOL_SIZE"), 20),
        "max_overflow": _to_int(os.getenv("DB_MAX_OVERFLOW"), 40),
    }

    @staticmethod
    def init_app(app):
        pass

class DevelopmentConfig(Config):
    DEBUG = True
    LOG_LEVEL = "DEBUG"

class ProductionConfig(Config):
    DEBUG = False
    SESSION_COOKIE_SECURE = True
    LOG_LEVEL = "INFO"

# Dicionário de configuração fora das classes
config_map = {
    "dev": DevelopmentConfig,
    "prod": ProductionConfig,
    "default": DevelopmentConfig
}

def get_config_class():
    env = os.getenv("APP_ENV", "dev").strip().lower()
    return config_map.get(env, config_map["default"])