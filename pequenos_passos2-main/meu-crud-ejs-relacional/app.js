import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import db from './db.js';

const app = express();

// Configurações
app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Sessão
app.use(session({
    secret: 'pequenos-passos',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 30 * 60 * 1000
    }
}));

// Chave usada para gerar o hash do CPF
const CHAVE_CPF = 'saep_pequenos_passos_chave_trocar';

// Gerar hash do CPF
function gerarHashCPF(cpf) {
    const cpfLimpo = cpf.replace(/\D/g, '');

    return crypto
        .createHmac('sha256', CHAVE_CPF)
        .update(cpfLimpo)
        .digest('hex');
}

// Verificar login
function verificarLogin(req, res, next) {
    if (!req.session.usuario) {
        return res.redirect('/login');
    }

    next();
}

// Página inicial
app.get('/', (req, res) => {
    res.redirect('/login');
});

// =====================================
// LOGIN
// =====================================

app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        if (!email || !senha) {
            return res.render('login', {
                erro: 'Preencha o e-mail e a senha.'
            });
        }

        const resultado = await db.query(
            'SELECT id, nome, email, senha FROM usuarios WHERE email = $1',
            [email.trim()]
        );

        if (resultado.rows.length === 0) {
            return res.render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }

        const usuario = resultado.rows[0];

        const senhaCorreta = await bcrypt.compare(
            senha,
            usuario.senha
        );

        if (!senhaCorreta) {
            return res.render('login', {
                erro: 'E-mail ou senha incorretos.'
            });
        }

        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            email: usuario.email
        };

        res.redirect('/dashboard');

    } catch (erro) {
        console.error('Erro no login:', erro);

        res.status(500).render('login', {
            erro: 'Erro ao realizar login.'
        });
    }
});

// =====================================
// DASHBOARD
// =====================================

app.get('/dashboard', verificarLogin, (req, res) => {
    res.render('dashboard', {
        usuario: req.session.usuario
    });
});

// =====================================
// RESPONSÁVEIS
// =====================================

// Listar responsáveis
app.get('/responsaveis', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                id AS id_responsavel,
                nome,
                cpf_hash,
                telefone,
                email
             FROM responsaveis
             ORDER BY nome`
        );

        res.render('responsaveis', {
            responsaveis: resultado.rows
        });

    } catch (erro) {
        console.error('Erro ao listar responsáveis:', erro);
        res.status(500).send('Erro ao carregar responsáveis.');
    }
});

// Cadastrar responsável
app.post('/responsaveis/cadastrar', verificarLogin, async (req, res) => {
    try {
        const { nome, cpf, telefone, email } = req.body;

        const cpfHash = gerarHashCPF(cpf);

        await db.query(
            `INSERT INTO responsaveis
            (nome, cpf_hash, telefone, email)
            VALUES ($1, $2, $3, $4)`,
            [nome, cpfHash, telefone, email || null]
        );

        res.redirect('/responsaveis');

    } catch (erro) {
        console.error('Erro ao cadastrar responsável:', erro);
        res.status(500).send('Erro ao cadastrar responsável. Verifique se o CPF já está cadastrado.');
    }
});

// Excluir responsável
app.get('/responsaveis/excluir/:id', verificarLogin, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM responsaveis WHERE id = $1',
            [req.params.id]
        );

        res.redirect('/responsaveis');

    } catch (erro) {
        console.error('Erro ao excluir responsável:', erro);
        res.status(500).send('Não foi possível excluir. Verifique se existem crianças vinculadas a este responsável.');
    }
});

// Abrir edição
app.get('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                id AS id_responsavel,
                nome,
                telefone,
                email
             FROM responsaveis
             WHERE id = $1`,
            [req.params.id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).send('Responsável não encontrado.');
        }

        res.render('editar-responsavel', {
            responsavel: resultado.rows[0]
        });

    } catch (erro) {
        console.error('Erro ao abrir responsável:', erro);
        res.status(500).send('Erro ao carregar responsável.');
    }
});

// Salvar edição
app.post('/responsaveis/editar/:id', verificarLogin, async (req, res) => {
    try {
        const { nome, cpf, telefone, email } = req.body;

        await db.query(
            `UPDATE responsaveis
             SET nome = $1,
                 cpf_hash = $2,
                 telefone = $3,
                 email = $4
             WHERE id = $5`,
            [
                nome,
                gerarHashCPF(cpf),
                telefone,
                email || null,
                req.params.id
            ]
        );

        res.redirect('/responsaveis');

    } catch (erro) {
        console.error('Erro ao editar responsável:', erro);
        res.status(500).send('Erro ao atualizar responsável. Verifique o CPF.');
    }
});

// =====================================
// CRIANÇAS
// =====================================

// Listar crianças
app.get('/criancas', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                c.id AS id_crianca,
                c.nome,
                TO_CHAR(c.data_nascimento, 'DD/MM/YYYY') AS data_nascimento,
                c.responsavel_id,
                r.nome AS nome_responsavel
             FROM criancas c
             JOIN responsaveis r ON r.id = c.responsavel_id
             ORDER BY c.nome`
        );

        const responsaveis = await db.query(
            'SELECT id AS id_responsavel, nome FROM responsaveis ORDER BY nome'
        );

        res.render('criancas', {
            criancas: resultado.rows,
            responsaveis: responsaveis.rows
        });

    } catch (erro) {
        console.error('Erro ao listar crianças:', erro);
        res.status(500).send('Erro ao carregar crianças.');
    }
});

// Nova criança
app.get('/criancas/nova', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT id AS id_responsavel, nome FROM responsaveis ORDER BY nome'
        );

        res.render('nova-crianca', {
            responsaveis: resultado.rows
        });

    } catch (erro) {
        console.error('Erro ao abrir cadastro de criança:', erro);
        res.status(500).send('Erro ao abrir cadastro.');
    }
});

// Cadastrar criança
app.post('/criancas/cadastrar', verificarLogin, async (req, res) => {
    try {
        const { nome, data_nascimento, responsavel_id } = req.body;

        await db.query(
            `INSERT INTO criancas
            (nome, data_nascimento, responsavel_id)
            VALUES ($1, $2, $3)`,
            [nome, data_nascimento, responsavel_id]
        );

        res.redirect('/criancas');

    } catch (erro) {
        console.error('Erro ao cadastrar criança:', erro);
        res.status(500).send('Erro ao cadastrar criança.');
    }
});

// Excluir criança
app.get('/criancas/excluir/:id', verificarLogin, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM criancas WHERE id = $1',
            [req.params.id]
        );

        res.redirect('/criancas');

    } catch (erro) {
        console.error('Erro ao excluir criança:', erro);
        res.status(500).send('Não foi possível excluir esta criança. Ela pode possuir agendamentos vinculados.');
    }
});

// Abrir edição
app.get('/criancas/editar/:id', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                id AS id_crianca,
                nome,
                data_nascimento,
                responsavel_id
             FROM criancas
             WHERE id = $1`,
            [req.params.id]
        );

        const responsaveis = await db.query(
            'SELECT id AS id_responsavel, nome FROM responsaveis ORDER BY nome'
        );

        if (resultado.rows.length === 0) {
            return res.status(404).send('Criança não encontrada.');
        }

        res.render('editar-crianca', {
            crianca: resultado.rows[0],
            responsaveis: responsaveis.rows
        });

    } catch (erro) {
        console.error('Erro ao abrir edição da criança:', erro);
        res.status(500).send('Erro ao carregar criança.');
    }
});

// Salvar edição
app.post('/criancas/editar/:id', verificarLogin, async (req, res) => {
    try {
        const { nome, data_nascimento, responsavel_id } = req.body;

        await db.query(
            `UPDATE criancas
             SET nome = $1,
                 data_nascimento = $2,
                 responsavel_id = $3
             WHERE id = $4`,
            [nome, data_nascimento, responsavel_id, req.params.id]
        );

        res.redirect('/criancas');

    } catch (erro) {
        console.error('Erro ao editar criança:', erro);
        res.status(500).send('Erro ao atualizar criança.');
    }
});

// =====================================
// AGENDAMENTOS
// =====================================

// Listar agendamentos
app.get('/agendamentos', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                a.id AS id_agendamento,
                TO_CHAR(a.data_consulta::date, 'DD/MM/YYYY') AS data_consulta,
                TO_CHAR(a.horario::time, 'HH24:MI') AS horario,
                COALESCE(NULLIF(TRIM(a.especialidade), ''), 'Não informada') AS especialidade,
                a.descricao AS observacoes,
                c.nome AS nome_crianca
             FROM agendamentos a
             JOIN criancas c ON c.id = a.crianca_id
             ORDER BY a.data_consulta, a.horario`
        );

        const criancas = await db.query(
            'SELECT id AS id_crianca, nome FROM criancas ORDER BY nome'
        );

        res.render('agendamentos', {
            agendamentos: resultado.rows,
            criancas: criancas.rows
        });

    } catch (erro) {
        console.error('Erro ao listar agendamentos:', erro);
        res.status(500).send('Erro ao carregar agendamentos.');
    }
});

// Novo agendamento
app.get('/agendamentos/novo', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            'SELECT id AS id_crianca, nome FROM criancas ORDER BY nome'
        );

        res.render('novo-agendamento', {
            criancas: resultado.rows
        });

    } catch (erro) {
        console.error('Erro ao abrir agendamento:', erro);
        res.status(500).send('Erro ao abrir cadastro de agendamento.');
    }
});

// Cadastrar agendamento
app.post('/agendamentos/cadastrar', verificarLogin, async (req, res) => {
    try {
        const {
            crianca_id,
            data_consulta,
            horario,
            especialidade,
            observacoes
        } = req.body;

        await db.query(
            `INSERT INTO agendamentos
            (crianca_id, data_consulta, horario, especialidade, descricao)
            VALUES ($1, $2, $3, $4, $5)`,
            [
                crianca_id,
                data_consulta,
                horario,
                especialidade,
                observacoes || null
            ]
        );

        res.redirect('/agendamentos');

    } catch (erro) {
        console.error('Erro ao cadastrar agendamento:', erro);
        res.status(500).send('Erro ao cadastrar agendamento.');
    }
});

// Excluir agendamento
app.get('/agendamentos/excluir/:id', verificarLogin, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM agendamentos WHERE id = $1',
            [req.params.id]
        );

        res.redirect('/agendamentos');

    } catch (erro) {
        console.error('Erro ao excluir agendamento:', erro);
        res.status(500).send('Erro ao excluir agendamento.');
    }
});

// Abrir edição
app.get('/agendamentos/editar/:id', verificarLogin, async (req, res) => {
    try {
        const resultado = await db.query(
            `SELECT
                id AS id_agendamento,
                crianca_id,
                TO_CHAR(data_consulta::date, 'YYYY-MM-DD') AS data_consulta,
                TO_CHAR(horario::time, 'HH24:MI') AS horario,
                especialidade,
                descricao AS observacoes
             FROM agendamentos
             WHERE id = $1`,
            [req.params.id]
        );

        const criancas = await db.query(
            'SELECT id AS id_crianca, nome FROM criancas ORDER BY nome'
        );

        if (resultado.rows.length === 0) {
            return res.status(404).send('Agendamento não encontrado.');
        }

        res.render('editar-agendamento', {
            agendamento: resultado.rows[0],
            criancas: criancas.rows
        });

    } catch (erro) {
        console.error('Erro ao abrir agendamento:', erro);
        res.status(500).send('Erro ao carregar agendamento.');
    }
});

// Salvar edição
app.post('/agendamentos/editar/:id', verificarLogin, async (req, res) => {
    try {
        const {
            crianca_id,
            data_consulta,
            horario,
            especialidade,
            observacoes
        } = req.body;

        await db.query(
            `UPDATE agendamentos
             SET crianca_id = $1,
                 data_consulta = $2,
                 horario = $3,
                 especialidade = $4,
                 descricao = $5
             WHERE id = $6`,
            [
                crianca_id,
                data_consulta,
                horario,
                especialidade,
                observacoes || null,
                req.params.id
            ]
        );

        res.redirect('/agendamentos');

    } catch (erro) {
        console.error('Erro ao editar agendamento:', erro);
        res.status(500).send('Erro ao atualizar agendamento.');
    }
});

// =====================================
// LOGOUT
// =====================================

app.get('/logout', (req, res) => {
    req.session.destroy((erro) => {
        if (erro) {
            console.error('Erro ao encerrar sessão:', erro);
            return res.status(500).send('Erro ao sair.');
        }

        res.redirect('/login');
    });
});

// =====================================
// INICIALIZAÇÃO
// =====================================

app.listen(3000, () => {
    console.log('Sistema Pequenos Passos rodando em http://localhost:3000');
});