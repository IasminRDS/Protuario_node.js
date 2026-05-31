from flask import Blueprint, render_template

# Criando o blueprint principal
main_bp = Blueprint('main', __name__)

# Rota principal "/"
@main_bp.route("/")
def index():
    return render_template("index.html")

# Rota de teste opcional
@main_bp.route("/sobre")
def sobre():
    return "<h1>Sistema de Prontuário - Versão 1.0</h1>"