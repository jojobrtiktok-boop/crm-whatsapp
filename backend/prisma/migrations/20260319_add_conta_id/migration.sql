-- Add conta_id to all main tables (default 1 = first admin)
ALTER TABLE chips ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE funis ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE blacklist ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS conta_id INT NOT NULL DEFAULT 1;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS conta_id INT;

-- Update existing admin user(s) to have contaId = their own id
UPDATE usuarios SET conta_id = id WHERE role = 'admin' AND conta_id IS NULL;

-- Drop old unique constraints and add composite ones
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_key;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_nome_key;
ALTER TABLE blacklist DROP CONSTRAINT IF EXISTS blacklist_telefone_key;
ALTER TABLE configuracoes DROP CONSTRAINT IF EXISTS configuracoes_chave_key;

-- Add composite unique constraints
ALTER TABLE clientes ADD CONSTRAINT clientes_telefone_conta_key UNIQUE (telefone, conta_id);
ALTER TABLE tags ADD CONSTRAINT tags_nome_conta_key UNIQUE (nome, conta_id);
ALTER TABLE blacklist ADD CONSTRAINT blacklist_telefone_conta_key UNIQUE (telefone, conta_id);
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_chave_conta_key UNIQUE (chave, conta_id);
