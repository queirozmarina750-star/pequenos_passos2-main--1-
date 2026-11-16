
-- SAEP - Clinica Pediatrica Pequenos Passos

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS agendamentos CASCADE;
DROP TABLE IF EXISTS criancas CASCADE;
DROP TABLE IF EXISTS responsaveis CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- Tabela de usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
);

-- Tabela de responsaveis
CREATE TABLE responsaveis (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    cpf_hash CHAR(64) UNIQUE NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(120)
);

-- Tabela de criancas
CREATE TABLE criancas (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    data_nascimento DATE NOT NULL,
    responsavel_id INTEGER NOT NULL,
    CONSTRAINT fk_crianca_responsavel
        FOREIGN KEY (responsavel_id)
        REFERENCES responsaveis(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Tabela de agendamentos
CREATE TABLE agendamentos (
    id SERIAL PRIMARY KEY,
    crianca_id INTEGER NOT NULL,
    data_consulta DATE NOT NULL,
    horario TIME NOT NULL,
    descricao VARCHAR(255),
    CONSTRAINT fk_agendamento_crianca
        FOREIGN KEY (crianca_id)
        REFERENCES criancas(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- Usuarios de teste
-- Senha de todos: 123456
INSERT INTO usuarios (nome, email, senha) VALUES
('Ana Souza', 'recepcao1@pequenospassos.com', crypt('123456', gen_salt('bf', 10))),
('Bruno Lima', 'recepcao2@pequenospassos.com', crypt('123456', gen_salt('bf', 10))),
('Carla Mendes', 'recepcao3@pequenospassos.com', crypt('123456', gen_salt('bf', 10)));

-- Responsaveis de teste
-- CPFs ficticios armazenados como HMAC-SHA256
INSERT INTO responsaveis (nome, cpf_hash, telefone, email) VALUES
('Mariana Oliveira', encode(hmac('12345678901', 'saep_pequenos_passos_chave_trocar', 'sha256'), 'hex'), '(19) 99999-1001', 'mariana@email.com'),
('Rafael Santos', encode(hmac('23456789012', 'saep_pequenos_passos_chave_trocar', 'sha256'), 'hex'), '(19) 99999-1002', 'rafael@email.com'),
('Juliana Costa', encode(hmac('34567890123', 'saep_pequenos_passos_chave_trocar', 'sha256'), 'hex'), '(19) 99999-1003', 'juliana@email.com');

-- Criancas de teste
INSERT INTO criancas (nome, data_nascimento, responsavel_id) VALUES
('Lucas Oliveira', '2019-04-12', 1),
('Sofia Santos', '2020-08-25', 2),
('Pedro Costa', '2018-11-03', 3);

-- Agendamentos de teste
INSERT INTO agendamentos (crianca_id, data_consulta, horario, descricao) VALUES
(1, CURRENT_DATE + 1, '09:00', 'Consulta de rotina'),
(2, CURRENT_DATE + 2, '10:30', 'Acompanhamento pediatrico'),
(3, CURRENT_DATE + 3, '14:00', 'Retorno');

-- Conferir quantidade de registros
SELECT 'usuarios' AS tabela, COUNT(*) AS quantidade FROM usuarios
UNION ALL
SELECT 'responsaveis', COUNT(*) FROM responsaveis
UNION ALL
SELECT 'criancas', COUNT(*) FROM criancas
UNION ALL
SELECT 'agendamentos', COUNT(*) FROM agendamentos;

-- Consulta com JOIN
SELECT
    a.id AS agendamento_id,
    a.data_consulta,
    a.horario,
    a.descricao,
    c.nome AS crianca,
    r.nome AS responsavel,
    r.telefone
FROM agendamentos a
JOIN criancas c ON c.id = a.crianca_id
JOIN responsaveis r ON r.id = c.responsavel_id
ORDER BY a.data_consulta ASC, a.horario ASC;
