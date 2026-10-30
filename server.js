'use strict';

require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const MAX_LIMIT = 25000;
const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: String(process.env.PGSSL || 'false').toLowerCase() === 'true' ? { rejectUnauthorized: true } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 5
});

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname, { extensions: ['html'] }));

function messageErreur(err) {
  if (err.code === 'ECONNREFUSED') return 'Connexion refusée. Vérifiez que le service PostgreSQL est démarré et que PGHOST/PGPORT sont corrects.';
  if (err.code === '28P01' || err.code === '28000') return 'Authentification PostgreSQL refusée. Vérifiez PGUSER et PGPASSWORD dans .env.';
  if (err.code === '3D000') return 'Base de données introuvable. Vérifiez PGDATABASE dans .env.';
  if (err.code === 'ENOTFOUND') return 'Serveur PostgreSQL introuvable. Vérifiez PGHOST.';
  return err.message || 'Erreur inattendue du service PostgreSQL.';
}

app.get('/api/postgres/status', async (_req, res) => {
  try {
    const result = await pool.query('SELECT current_database() AS database, current_user AS username, version() AS version');
    res.json({ ok: true, message: `Connexion PostgreSQL opérationnelle · base ${result.rows[0].database} · utilisateur ${result.rows[0].username}.` });
  } catch (err) {
    res.status(503).json({ error: messageErreur(err) });
  }
});

app.get('/api/postgres/tables', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_schema AS schema, table_name AS name,
             CASE table_type WHEN 'VIEW' THEN 'vue' ELSE 'table' END AS type
      FROM information_schema.tables
      WHERE table_type IN ('BASE TABLE', 'VIEW')
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `);
    res.json({ tables: result.rows });
  } catch (err) {
    res.status(503).json({ error: messageErreur(err) });
  }
});

app.post('/api/postgres/import', async (req, res) => {
  const schema = String(req.body?.schema || 'public');
  const table = String(req.body?.table || '');
  const requestedLimit = Number(req.body?.limit || 5000);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 5000));
  if (!schema || !table || schema.length > 255 || table.length > 255) {
    return res.status(400).json({ error: 'Sélectionnez un schéma et une table valides.' });
  }
  try {
    // Vérifie que la table/vue existe et est visible avant de construire les identifiants SQL.
    const check = await pool.query(
      `SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2
         AND table_type IN ('BASE TABLE', 'VIEW')
         AND table_schema NOT IN ('pg_catalog', 'information_schema')`,
      [schema, table]
    );
    if (!check.rowCount) return res.status(404).json({ error: 'Cette table ou vue est introuvable ou non accessible.' });
    const quoteIdentifier = value => `"${String(value).replace(/"/g, '""')}"`;
    const qualified = `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
    const result = await pool.query(`SELECT * FROM ${qualified} LIMIT $1`, [limit]);
    res.json({ schema, table: `${schema}.${table}`, limit, rows: result.rows, rowCount: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: messageErreur(err) });
  }
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route API introuvable.' });
  res.sendFile(path.join(__dirname, 'index.html'), err => { if (err) next(err); });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Dimensionnement disponible sur http://localhost:${PORT}`);
  console.log('Connecteur PostgreSQL prêt à utiliser les paramètres du fichier .env.');
});

async function fermer() {
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', fermer);
process.on('SIGTERM', fermer);
