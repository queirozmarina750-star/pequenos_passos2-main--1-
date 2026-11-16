
import pg from 'pg';

const { Pool } = pg;

// Configuracao da conexao com o PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'pediatria',
    password: 'senai',
    port: 5432,
});

export default pool;
