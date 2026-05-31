# debug_env.py
import os
from dotenv import load_dotenv

# Força o carregamento do arquivo
load_dotenv(override=True)

db_url = os.getenv("DATABASE_URL")
print(f"DATABASE_URL lida: {db_url}")

if db_url and "://" in db_url:
    print("Sucesso: A variável foi lida corretamente e parece uma URL válida.")
else:
    print("Erro: A variável DATABASE_URL não foi carregada ou está mal formatada.")