import sqlite3

DB_PATH = "instance/prontuario.db"  # ajuste se seu DB estiver em outro caminho


def has_column(cur, table, column):
    cur.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cur.fetchall()]
    return column in cols


def ensure_column(cur, table, col_def, col_name):
    if not has_column(cur, table, col_name):
        cur.execute(f"ALTER TABLE {table} ADD COLUMN {col_def}")
        print(f"[OK] coluna criada: {table}.{col_name}")
    else:
        print(f"[SKIP] coluna já existe: {table}.{col_name}")


def table_exists(cur, table):
    cur.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    )
    return cur.fetchone() is not None


def ensure_index(cur, idx_sql, idx_name):
    try:
        cur.execute(idx_sql)
        print(f"[OK] índice verificado/criado: {idx_name}")
    except Exception as e:
        print(f"[WARN] índice {idx_name}: {e}")


conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

# 1) tabela regionais
if not table_exists(cur, "regionais"):
    cur.execute(
        """
    CREATE TABLE regionais (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome VARCHAR(120) NOT NULL UNIQUE,
        codigo VARCHAR(20) UNIQUE,
        uf VARCHAR(2) NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT 1,
        criado_em DATETIME
    )
    """
    )
    print("[OK] tabela criada: regionais")
else:
    print("[SKIP] tabela já existe: regionais")

# 2) users: novas colunas
ensure_column(
    cur, "users", "nivel_acesso VARCHAR(20) NOT NULL DEFAULT 'UNIDADE'", "nivel_acesso"
)
ensure_column(cur, "users", "regional_id INTEGER", "regional_id")
ensure_column(cur, "users", "municipio_ibge VARCHAR(7)", "municipio_ibge")
ensure_column(cur, "users", "uf VARCHAR(2)", "uf")

# 3) unidades: novas colunas
ensure_column(cur, "unidades", "municipio_ibge VARCHAR(7)", "municipio_ibge")
ensure_column(cur, "unidades", "regional_id INTEGER", "regional_id")

# 4) pacientes: coluna municipal padronizada (opcional, mas recomendada)
ensure_column(cur, "pacientes", "municipio_ibge VARCHAR(7)", "municipio_ibge")

# 5) índices de performance
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_users_nivel_acesso ON users (nivel_acesso)",
    "ix_users_nivel_acesso",
)
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_users_regional_id ON users (regional_id)",
    "ix_users_regional_id",
)
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_users_municipio_ibge ON users (municipio_ibge)",
    "ix_users_municipio_ibge",
)
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_unidades_regional_id ON unidades (regional_id)",
    "ix_unidades_regional_id",
)
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_unidades_municipio_ibge ON unidades (municipio_ibge)",
    "ix_unidades_municipio_ibge",
)
ensure_index(
    cur,
    "CREATE INDEX IF NOT EXISTS ix_pacientes_municipio_ibge ON pacientes (municipio_ibge)",
    "ix_pacientes_municipio_ibge",
)

conn.commit()
conn.close()
print("\nMigração concluída com sucesso.")
