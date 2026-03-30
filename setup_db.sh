#!/bin/bash
set -e
echo ">>> Starting PostgreSQL..."
sudo service postgresql start
echo ">>> Creating database user and database..."
sudo -u postgres psql -c "CREATE USER asset_admin WITH PASSWORD 'AssetRisk2026';"
sudo -u postgres psql -c "CREATE DATABASE asset_risk_db OWNER asset_admin;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE asset_risk_db TO asset_admin;"
echo ">>> PostgreSQL setup complete!"
echo ">>> Testing connection..."
PGPASSWORD='AssetRisk2026' psql -h 127.0.0.1 -U asset_admin -d asset_risk_db -c "SELECT 1 AS ok;"
echo ">>> All done!"
