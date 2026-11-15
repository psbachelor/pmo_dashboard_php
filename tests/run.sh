#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DOCKER_SOCKET=${DOCKER_SOCKET:-unix:///var/run/docker.sock}
dkr() { env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host="$DOCKER_SOCKET" "$@"; }
label="vcx-pmo-suite-$$"
port=${PMO_TEST_PORT:-18080}
mkdir -p tests/artifacts
cleanup() { dkr rm -fv "$label-web" "$label-db" >/dev/null 2>&1 || true; dkr network rm "$label" >/dev/null 2>&1 || true; }
trap cleanup EXIT
# This creates only disposable, private test containers. No hosting deployment.
dkr build -t vcx-pmo-php:8.3 . > tests/artifacts/build.log 2>&1
dkr network create "$label" >/dev/null
dkr run -d --name "$label-db" --network "$label" --network-alias mysql -e MYSQL_ALLOW_EMPTY_PASSWORD=yes -e MYSQL_DATABASE=vcx_pmo_test mysql:8.0 >/dev/null
dkr run -d --name "$label-web" --network "$label" -p "127.0.0.1:$port:8080" -v "$PWD:/app" -e DB_HOST=mysql -e DB_DATABASE=vcx_pmo_test -e DB_USERNAME=root -e AUTH_PEPPER=synthetic-test-pepper-synthetic-test-pepper vcx-pmo-php:8.3 >/dev/null
ready=0
for n in $(seq 1 60); do
 if dkr exec "$label-web" php -r 'require "app/bootstrap.php"; try {VCX\Core\Database::connect();} catch(Throwable $e) {exit(1);}' >/dev/null 2>&1; then ready=1; break; fi
 sleep 1
done
if [ "$ready" -ne 1 ]; then echo 'MySQL did not become ready'; exit 1; fi
execphp() { dkr exec "$label-web" php "$@"; }
dkr exec "$label-web" sh -c 'find app public scripts tests -name "*.php" -print0 | xargs -0 -n1 php -l' | tee tests/artifacts/syntax.log
node --check public/assets/app.js
execphp scripts/migrate.php | tee tests/artifacts/migrate.log
execphp scripts/migrate.php | tee -a tests/artifacts/migrate.log
execphp scripts/seed.php > tests/artifacts/seed.log
execphp scripts/validate.php | tee tests/artifacts/schema.log
execphp tests/parity.php | tee tests/artifacts/parity.log
execphp tests/oracle.php | tee tests/artifacts/oracle.log
execphp tests/oracle.php --legacy | tee tests/artifacts/legacy-oracle.log
execphp tests/migration.php | tee tests/artifacts/migration.log
execphp tests/concurrency.php | tee tests/artifacts/concurrency.log
execphp scripts/import.php --input=database/seed.json > tests/artifacts/import-dry-run.json
dkr exec -e BOOTSTRAP_ADMIN_USERNAME=admin -e BOOTSTRAP_ADMIN_PASSWORD=temporary-test-password "$label-web" php scripts/create_admin.php | tee tests/artifacts/bootstrap.log
export PMO_TEST_URL="http://127.0.0.1:$port/"
node tests/api.cjs | tee tests/artifacts/api.log
execphp scripts/export.php /tmp/pmo-suite-backup.json | tee tests/artifacts/export.log
execphp scripts/clean_pilot.php --input=/tmp/pmo-suite-backup.json --output=/tmp/pmo-suite-clean.json | tee tests/artifacts/clean-pilot.log
node tests/browser.cjs | tee tests/artifacts/browser.log
node tests/security.cjs | tee tests/artifacts/security.log
execphp scripts/validate.php | tee tests/artifacts/post-browser-schema.log
dkr logs "$label-web" > tests/artifacts/server.log 2>&1
echo 'All requested suite commands passed; see tests/artifacts/.'
