# -*- coding: utf-8 -*-
from flask import Blueprint, redirect, url_for
from flask_login import login_required

# Blueprint legado: mantém /leitos e endpoint leitos.index
# para não quebrar links antigos/menu.
leitos_bp = Blueprint("leitos", __name__, url_prefix="/leitos")


@leitos_bp.route("", methods=["GET"])
@leitos_bp.route("/", methods=["GET"])
@login_required
def index():
    # Redirecionamento permanente para a tela nova de leitos em internação
    return redirect(url_for("internacao.leitos"), code=301)
