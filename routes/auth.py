from urllib.parse import urlparse, urljoin
from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required, current_user

from database.db import db
from models.user import User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

def _is_safe_next_url(target: str) -> bool:
    """Garante redirecionamento interno (evita open redirect)."""
    if not target:
        return False
    ref_url = urlparse(request.host_url)
    test_url = urlparse(urljoin(request.host_url, target))
    return test_url.scheme in ("http", "https") and ref_url.netloc == test_url.netloc

def _verify_password(user: User, senha: str) -> bool:
    if not senha:
        return False
    if hasattr(user, "check_password") and callable(getattr(user, "check_password")):
        return bool(user.check_password(senha))
    if hasattr(user, "verificar_senha") and callable(getattr(user, "verificar_senha")):
        return bool(user.verificar_senha(senha))
    return False

@auth_bp.get("/login")
def login():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard.index"))
    return render_template("auth/login.html", auth_layout=True)

@auth_bp.post("/login")
def login_post():
    identidade = (request.form.get("email") or request.form.get("username") or "").strip().lower()
    senha = request.form.get("senha", "")

    if not identidade or not senha:
        flash("Informe e-mail/usuário e senha.", "warning")
        return redirect(url_for("auth.login", next=request.args.get("next")))

    user = User.query.filter(User.email == identidade).first()
    if not user and hasattr(User, "username"):
        user = User.query.filter(User.username == identidade).first()

    if not user or (hasattr(user, "ativo") and not user.ativo) or not _verify_password(user, senha):
        flash("Credenciais inválidas ou usuário inativo.", "danger")
        return redirect(url_for("auth.login", next=request.args.get("next")))

    login_user(user, remember=True)

    if hasattr(user, "ultimo_acesso"):
        try:
            from datetime import datetime
            user.ultimo_acesso = datetime.utcnow()
            db.session.commit()
        except Exception:
            db.session.rollback()

    flash("Login realizado com sucesso.", "success")
    next_page = request.args.get("next")
    if next_page and _is_safe_next_url(next_page):
        return redirect(next_page)

    return redirect(url_for("dashboard.index"))

# ROTA ÚNICA DE LOGOUT (Corrigida)
@auth_bp.route('/logout', methods=['GET', 'POST'])
@login_required
def logout():
    logout_user()
    flash("Sessão encerrada com sucesso.", "info")
    return redirect(url_for("auth.login"))