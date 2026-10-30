require("dotenv").config();
const { Pool } = require("pg");

console.log("Configuration utilisée :");
console.log({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  passwordPresent: Boolean(process.env.PGPASSWORD)
});

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl: false,
  connectionTimeoutMillis: 5000
});

pool.query("SELECT current_database(), current_user, version()")
  .then(result => console.log("CONNEXION OK :", result.rows[0]))
  .catch(error => console.log("ERREUR :", {
    code: error.code,
    message: error.message
  }))
  .finally(() => pool.end());
