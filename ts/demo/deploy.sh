#!/usr/bin/env bash
# Deploy do frontend (behuman) para a Hostinger:
#   build (com base) -> .htaccess + extrator PHP -> zip -> upload FTPS -> extração via HTTP -> limpeza.
# Credenciais ficam em ts/demo/.deploy.env (NÃO versionado). Veja .deploy.env.example.
# Uso: cd ts/demo && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

ENVF=".deploy.env"
[ -f "$ENVF" ] || { echo "ERRO: $ENVF não encontrado. Copie .deploy.env.example -> .deploy.env e preencha."; exit 1; }
set -a; source "$ENVF"; set +a

BASE="${BASE:-/behuman/}"
PORT="${DEPLOY_PORT:-21}"
KEY="${UNZIP_KEY:-behuman-deploy-2026}"

echo "==> Build (base=$BASE)"
npm run build -- --base="$BASE"

echo "==> Gera .htaccess (SPA) + extrator"
cat > dist/.htaccess <<EOF
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase ${BASE}
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . ${BASE}index.html [L]
</IfModule>
EOF
cat > dist/unzip.php <<EOF
<?php
header('Content-Type: text/plain; charset=utf-8');
if ((\$_GET['key'] ?? '') !== '${KEY}') { http_response_code(403); exit("forbidden\n"); }
\$zip = __DIR__ . '/site.zip';
if (!file_exists(\$zip)) { http_response_code(404); exit("site.zip nao encontrado\n"); }
\$za = new ZipArchive();
if (\$za->open(\$zip) !== true) { http_response_code(500); exit("falha ao abrir zip\n"); }
\$n = \$za->numFiles; \$za->extractTo(__DIR__); \$za->close();
@unlink(\$zip); echo "OK: \$n arquivos extraidos\n"; @unlink(__FILE__); echo "extrator removido\n";
EOF

echo "==> Compacta dist"
rm -f site.zip
( cd dist && zip -r -q -X ../site.zip . -x "unzip.php" )
echo "    $(du -h site.zip | cut -f1)"

echo "==> Upload FTPS -> ${DEPLOY_HOST}/${DEPLOY_REMOTE_DIR}"
curl -fsS --ssl-reqd -k --ftp-pasv --ftp-create-dirs -T site.zip \
  --user "${DEPLOY_USER}:${DEPLOY_PASS}" \
  "ftp://${DEPLOY_HOST}:${PORT}/${DEPLOY_REMOTE_DIR}/site.zip" -w "    site.zip: FTP %{http_code}\n" -o /dev/null
curl -fsS --ssl-reqd -k --ftp-pasv -T dist/unzip.php \
  --user "${DEPLOY_USER}:${DEPLOY_PASS}" \
  "ftp://${DEPLOY_HOST}:${PORT}/${DEPLOY_REMOTE_DIR}/unzip.php" -w "    unzip.php: FTP %{http_code}\n" -o /dev/null

echo "==> Extrai no servidor"
curl -fsS --max-time 120 "${SITE_URL}/unzip.php?key=${KEY}" -w "\n    [HTTP %{http_code}]\n"

echo "==> Limpeza local"
rm -f site.zip dist/unzip.php
echo "==> Concluído: ${SITE_URL}/"
