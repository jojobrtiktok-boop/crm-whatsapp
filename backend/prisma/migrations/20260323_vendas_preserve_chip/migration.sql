-- Make chip_id nullable in vendas (preserve sales when chip deleted)
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS conta_id INT;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS chip_nome VARCHAR;

-- Populate conta_id from chip relation
UPDATE vendas SET conta_id = (SELECT conta_id FROM chips WHERE chips.id = vendas.chip_id) WHERE conta_id IS NULL;
UPDATE vendas SET conta_id = 1 WHERE conta_id IS NULL;

-- Populate chip_nome from chip relation
UPDATE vendas SET chip_nome = (SELECT nome FROM chips WHERE chips.id = vendas.chip_id) WHERE chip_nome IS NULL;

-- Drop FK, make nullable, re-add with SET NULL
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_chip_id_fkey;
ALTER TABLE vendas ALTER COLUMN chip_id DROP NOT NULL;
ALTER TABLE vendas ADD CONSTRAINT vendas_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES chips(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS vendas_conta_id_idx ON vendas(conta_id);

-- Make chip_id nullable in comprovantes too
ALTER TABLE comprovantes ADD COLUMN IF NOT EXISTS conta_id INT;
UPDATE comprovantes SET conta_id = (SELECT conta_id FROM chips WHERE chips.id = comprovantes.chip_id) WHERE conta_id IS NULL;
UPDATE comprovantes SET conta_id = 1 WHERE conta_id IS NULL;
ALTER TABLE comprovantes DROP CONSTRAINT IF EXISTS comprovantes_chip_id_fkey;
ALTER TABLE comprovantes ALTER COLUMN chip_id DROP NOT NULL;
ALTER TABLE comprovantes ADD CONSTRAINT comprovantes_chip_id_fkey FOREIGN KEY (chip_id) REFERENCES chips(id) ON DELETE SET NULL;
