from functools import wraps
from flask import abort, flash, redirect, url_for
from flask_login import current_user
import re

# ===============================
# Validações
# ===============================
_CPF_RE = re.compile(r"^\d{11}$")
_CNS_RE = re.compile(r"^\d{15}$")
_IBGE_RE = re.compile(r"^\d{7}$")
_CID10_RE = re.compile(r"^[A-TV-Z][0-9][0-9AB](\.[0-9A-KXZ]{1,2})?$")


def validar_cpf(cpf: str) -> bool:
    cpf = (cpf or "").strip().replace(".", "").replace("-", "")
    return bool(_CPF_RE.fullmatch(cpf))


def validar_cns(cns: str) -> bool:
    return bool(_CNS_RE.fullmatch((cns or "").strip()))


def validar_ibge(cod: str) -> bool:
    return bool(_IBGE_RE.fullmatch((cod or "").strip()))


def validar_cid10(cid: str) -> bool:
    return bool(_CID10_RE.fullmatch((cid or "").strip().upper()))


# ===============================
# Controle por perfil (já usado)
# ===============================
def perfil_requerido(*perfis):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated:
                return redirect(url_for("auth.login"))
            if current_user.perfil not in perfis and current_user.perfil != "admin":
                flash("Você não tem permissão para acessar esta área.", "danger")
                abort(403)
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def medico_requerido(f):
    return perfil_requerido("medico", "admin")(f)


def admin_requerido(f):
    return perfil_requerido("admin")(f)


# ===============================
# Escopo territorial
# ===============================
def pode_acessar_paciente(paciente, usuario):
    if usuario.perfil == "admin":
        return True

    nivel = getattr(usuario, "nivel_acesso", "UNIDADE")

    if nivel == "ESTADO":
        return True

    # MUNICIPIO: preferir municipio_ibge
    if nivel == "MUNICIPIO":
        user_ibge = getattr(usuario, "municipio_ibge", None)
        pac_ibge = getattr(paciente, "municipio_ibge", None)
        if user_ibge and pac_ibge:
            return str(user_ibge) == str(pac_ibge)

        # fallback por unidade->municipio/uf
        if usuario.unidade:
            return (
                paciente.municipio == usuario.unidade.municipio
                and paciente.uf == usuario.unidade.uf
            )
        return False

    # REGIONAL: fallback por UF (até mapear regional no paciente)
    if nivel == "REGIONAL":
        if getattr(usuario, "uf", None) and getattr(paciente, "uf", None):
            return usuario.uf == paciente.uf
        return False

    # UNIDADE: por município/UF da unidade
    if nivel == "UNIDADE":
        if usuario.unidade:
            return (
                paciente.municipio == usuario.unidade.municipio
                and paciente.uf == usuario.unidade.uf
            )
        return False

    return False


def pode_acessar_prontuario(prontuario, usuario):
    if usuario.perfil == "admin":
        return True

    nivel = getattr(usuario, "nivel_acesso", "UNIDADE")
    if nivel == "ESTADO":
        return True

    if nivel in ("UNIDADE", "MUNICIPIO"):
        if usuario.unidade_id and prontuario.unidade_id:
            return usuario.unidade_id == prontuario.unidade_id
        return False

    if nivel == "REGIONAL":
        unidade = getattr(prontuario, "unidade", None)
        return bool(
            unidade
            and getattr(usuario, "regional_id", None)
            and unidade.regional_id == usuario.regional_id
        )

    return False
