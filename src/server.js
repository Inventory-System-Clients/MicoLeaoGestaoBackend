import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sequelize } from "./database/connection.js";
import routes from "./routes/index.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const dataRetentionEnabled = process.env.DATA_RETENTION_ENABLED === "true";

// Middlewares
app.use(
  helmet({
    contentSecurityPolicy: false, // Permitir recursos inline para a página de relatório
  }),
);

// Configurar CORS para aceitar localhost e produção
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://micoleaogestao.selfmachine.com.br",
  "https://grupogk.selfmachine.com.br",
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, "")); // Remove undefined e barra final

const isOriginAllowed = (origin) => {
  if (!origin) return true; // Permitir requisições sem origin (Postman, curl, health checks)
  if (allowedOrigins.includes("*")) return true;

  const normalizedOrigin = origin.replace(/\/$/, "");
  if (allowedOrigins.includes(normalizedOrigin)) return true;

  try {
    const { protocol, hostname } = new URL(normalizedOrigin);
    return protocol === "https:" && hostname.endsWith(".selfmachine.com.br");
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(morgan("dev"));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos da pasta public
app.use("/public", express.static(path.join(__dirname, "..", "public")));

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Agarra Mais API",
    version: "1.0.0",
    status: "online",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      usuarios: "/api/usuarios",
      lojas: "/api/lojas",
      maquinas: "/api/maquinas",
      produtos: "/api/produtos",
      movimentacoes: "/api/movimentacoes",
      relatorios: "/api/relatorios",
    },
  });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Debug endpoint - remover em produção
app.get("/debug/admin", async (req, res) => {
  const { Usuario } = await import("./models/index.js");
  const admin = await Usuario.findOne({
    where: { email: process.env.ADMIN_EMAIL || "admin@agarramais.com" },
  });
  res.json({
    adminExists: !!admin,
    email: admin?.email,
    role: admin?.role,
    ativo: admin?.ativo,
  });
});

// Routes
app.use("/api", routes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);

  if (isOriginAllowed(req.headers.origin)) {
    res.header("Access-Control-Allow-Origin", req.headers.origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
  }

  res.status(err.status || 500).json({
    error: {
      message: err.message || "Erro interno do servidor",
      status: err.status || 500,
    },
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Conexão com PostgreSQL estabelecida com sucesso!");

    // Sync database - cria novas tabelas/colunas mas não altera existentes
    // Para evitar erros de sintaxe SQL ao adicionar constraints
    await sequelize.sync();
    console.log("✅ Database sincronizado!");

    const queryInterface = sequelize.getQueryInterface();
    await sequelize.query(`
      ALTER TYPE "enum_usuarios_role" ADD VALUE IF NOT EXISTS 'DESENVOLVEDOR';
    `);
    await sequelize.query(`
      ALTER TYPE "enum_usuarios_role" ADD VALUE IF NOT EXISTS 'FUNCIONARIO_ESTOQUE';
    `);
    await sequelize.query(`
      ALTER TYPE "enum_usuarios_role" ADD VALUE IF NOT EXISTS 'FUNCIONARIO_CADASTRO';
    `);

    {
      // Perfil "Funcionário de Fábrica" foi descontinuado: as tarefas de
      // fábrica (insumos, receitas, pedidos de pelúcia) passaram a ser
      // feitas pelo Funcionário de Estoque. Migra quem ainda estiver com
      // o perfil antigo e remove o valor do enum do Postgres. Idempotente:
      // só roda se o enum ainda tiver o valor antigo.
      const [enumRows] = await sequelize.query(`
        SELECT e.enumlabel FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_usuarios_role'
        ORDER BY e.enumsortorder
      `);
      const roleLabels = enumRows.map((linha) => linha.enumlabel);

      if (roleLabels.includes("FUNCIONARIO_FABRICA")) {
        const novosLabels = roleLabels.filter(
          (label) => label !== "FUNCIONARIO_FABRICA",
        );
        const listaEnumSql = novosLabels
          .map((label) => `'${label}'`)
          .join(", ");

        await sequelize.query(`
          ALTER TABLE usuarios ALTER COLUMN role DROP DEFAULT;
          ALTER TABLE usuarios ALTER COLUMN role TYPE VARCHAR(30) USING role::text;
          UPDATE usuarios SET role = 'FUNCIONARIO_ESTOQUE' WHERE role = 'FUNCIONARIO_FABRICA';
          DROP TYPE IF EXISTS "enum_usuarios_role";
          CREATE TYPE "enum_usuarios_role" AS ENUM (${listaEnumSql});
          ALTER TABLE usuarios ALTER COLUMN role TYPE "enum_usuarios_role" USING role::"enum_usuarios_role";
          ALTER TABLE usuarios ALTER COLUMN role SET DEFAULT 'FUNCIONARIO';
        `);
        console.log(
          "✅ Perfil Funcionário de Fábrica removido: usuários migrados para Funcionário de Estoque!",
        );
      }
    }

    {
      // Transportador deixou de ser um usuário com login: agora é só um
      // nome cadastrado (tabela `transportadores`, sem autenticação). Solta
      // a FK antiga de envios.transportadorId -> usuarios (se ainda
      // apontar pra lá), migra quem hoje tem perfil ENTREGADOR pra um
      // registro de Transportador (reaproveitando o nome nos envios já
      // feitos), desativa a conta (não loga mais) e garante a FK nova
      // apontando pra transportadores. Idempotente.
      const [fkAntigas] = await sequelize.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_name = 'envios'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'transportadorId'
          AND ccu.table_name = 'usuarios'
      `);
      for (const fk of fkAntigas) {
        await sequelize.query(
          `ALTER TABLE envios DROP CONSTRAINT IF EXISTS "${fk.constraint_name}"`,
        );
      }

      const { Usuario, Envio, Transportador } = await import(
        "./models/index.js"
      );
      const entregadores = await Usuario.findAll({
        where: { role: "ENTREGADOR" },
      });

      for (const usuarioEntregador of entregadores) {
        let transportador = await Transportador.findOne({
          where: { nome: usuarioEntregador.nome },
        });
        if (!transportador) {
          transportador = await Transportador.create({
            nome: usuarioEntregador.nome,
          });
        }

        await Envio.update(
          { transportadorId: transportador.id },
          { where: { transportadorId: usuarioEntregador.id } },
        );

        await usuarioEntregador.update({ ativo: false, role: "FUNCIONARIO" });
      }

      if (entregadores.length > 0) {
        console.log(
          `✅ ${entregadores.length} conta(s) de entregador migradas para transportador (cadastro simples) e desativadas!`,
        );
      }

      const [fkNovas] = await sequelize.query(`
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
          AND tc.table_schema = ccu.table_schema
        WHERE tc.table_name = 'envios'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'transportadores'
      `);
      if (fkNovas.length === 0) {
        await sequelize.query(`
          ALTER TABLE envios
          ADD CONSTRAINT envios_transportadorid_transportadores_fkey
          FOREIGN KEY ("transportadorId") REFERENCES transportadores(id);
        `);
      }
    }

    {
      // Remove o valor ENTREGADOR do enum de roles — ninguém mais loga
      // como entregador (virou o cadastro simples de Transportador acima).
      // Idempotente: só roda se o enum ainda tiver o valor antigo.
      const [enumRowsEntregador] = await sequelize.query(`
        SELECT e.enumlabel FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_usuarios_role'
        ORDER BY e.enumsortorder
      `);
      const roleLabelsEntregador = enumRowsEntregador.map(
        (linha) => linha.enumlabel,
      );

      if (roleLabelsEntregador.includes("ENTREGADOR")) {
        const novosLabelsEntregador = roleLabelsEntregador.filter(
          (label) => label !== "ENTREGADOR",
        );
        const listaEnumSqlEntregador = novosLabelsEntregador
          .map((label) => `'${label}'`)
          .join(", ");

        await sequelize.query(`
          ALTER TABLE usuarios ALTER COLUMN role DROP DEFAULT;
          ALTER TABLE usuarios ALTER COLUMN role TYPE VARCHAR(30) USING role::text;
          UPDATE usuarios SET role = 'FUNCIONARIO' WHERE role = 'ENTREGADOR';
          DROP TYPE IF EXISTS "enum_usuarios_role";
          CREATE TYPE "enum_usuarios_role" AS ENUM (${listaEnumSqlEntregador});
          ALTER TABLE usuarios ALTER COLUMN role TYPE "enum_usuarios_role" USING role::"enum_usuarios_role";
          ALTER TABLE usuarios ALTER COLUMN role SET DEFAULT 'FUNCIONARIO';
        `);
        console.log(
          "✅ Perfil Entregador removido: enum atualizado!",
        );
      }
    }

    {
      // Semeia o catálogo de Tipo de Máquina a partir dos valores de
      // `tipo` já usados nas máquinas cadastradas — assim quem já tinha
      // "Garra", "Poltrona" etc. digitado à mão continua vendo essas
      // opções no select novo, sem precisar recadastrar nada. Idempotente:
      // só cria o que ainda não existe no catálogo.
      const { Op } = await import("sequelize");
      const { Maquina, TipoMaquina } = await import("./models/index.js");

      const maquinasComTipo = await Maquina.findAll({
        attributes: ["tipo", "capacidadePadrao"],
        where: { tipo: { [Op.ne]: null } },
        raw: true,
      });

      const capacidadePorTipo = new Map();
      for (const maquina of maquinasComTipo) {
        const nomeTipo = String(maquina.tipo || "").trim();
        if (!nomeTipo || capacidadePorTipo.has(nomeTipo)) continue;
        capacidadePorTipo.set(nomeTipo, maquina.capacidadePadrao || 100);
      }

      let tiposCriados = 0;
      for (const [nomeTipo, capacidadePadrao] of capacidadePorTipo) {
        const [, criado] = await TipoMaquina.findOrCreate({
          where: { nome: nomeTipo },
          defaults: { capacidadePadrao },
        });
        if (criado) tiposCriados++;
      }

      if (tiposCriados > 0) {
        console.log(
          `✅ ${tiposCriados} tipo(s) de máquina migrados pro catálogo novo!`,
        );
      }
    }

    const colunasMaquinas = await queryInterface.describeTable("maquinas");
    const colunasLojas = await queryInterface.describeTable("lojas");

    {
      if (colunasMaquinas.lojaId?.allowNull === false) {
        // queryInterface.changeColumn com "references" não estava emitindo o
        // DROP NOT NULL no Postgres (só recriava a FK) — por isso o SQL direto.
        await sequelize.query(
          'ALTER TABLE "maquinas" ALTER COLUMN "lojaId" DROP NOT NULL;',
        );
        console.log("✅ Coluna lojaId das máquinas agora aceita sem loja!");
      }
    }

    // Criar admin padrão se não existir
    if (!colunasMaquinas.jogadas_boas_por_pelucia) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("maquinas", "jogadas_boas_por_pelucia", {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Quantidade ideal de jogadas para sair uma pelúcia",
      });
      console.log(
        "âÅ“… Coluna de jogadas boas por pelúcia adicionada às máquinas!",
      );
    }

    {
      const { DataTypes } = await import("sequelize");
      const colunasNovasMaquinas = [
        [
          "status_operacao",
          {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "EM_OPERACAO",
          },
        ],
        [
          "datas_auditoria",
          {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
          },
        ],
        [
          "motivo_parada",
          {
            type: DataTypes.TEXT,
            allowNull: true,
          },
        ],
        [
          "auditoria",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
        ],
        [
          "geradora_receita",
          {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
        ],
        [
          "categoria_geradora",
          {
            type: DataTypes.STRING(20),
            allowNull: true,
          },
        ],
        [
          "telemetria",
          {
            type: DataTypes.STRING(100),
            allowNull: true,
          },
        ],
        [
          "valor_jogada",
          {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true,
          },
        ],
      ];

      for (const [nomeColuna, definicao] of colunasNovasMaquinas) {
        if (!colunasMaquinas[nomeColuna]) {
          await queryInterface.addColumn("maquinas", nomeColuna, definicao);
          console.log(`✅ Coluna ${nomeColuna} adicionada às máquinas!`);
        }
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const tabelas = await queryInterface.showAllTables();
      if (tabelas.includes("roteiros")) {
        const colunasRoteiros = await queryInterface.describeTable("roteiros");
        const colunasResetRoteiros = [
          [
            "dia_semana_reset",
            { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
          ],
          [
            "hora_reset",
            { type: DataTypes.STRING(5), allowNull: false, defaultValue: "23:59" },
          ],
          ["ultimo_reset_em", { type: DataTypes.DATE, allowNull: true }],
        ];

        for (const [nomeColuna, definicao] of colunasResetRoteiros) {
          if (!colunasRoteiros[nomeColuna]) {
            await queryInterface.addColumn("roteiros", nomeColuna, definicao);
            console.log(`✅ Coluna ${nomeColuna} adicionada aos roteiros!`);
          }
        }

        // Migração: diaSemanaReset/horaReset (par único) -> resetsAgendados (lista de pares)
        if (!colunasRoteiros.resets_agendados) {
          await queryInterface.addColumn("roteiros", "resets_agendados", {
            type: DataTypes.JSON,
            allowNull: true,
          });
          console.log("✅ Coluna resets_agendados adicionada aos roteiros!");

          if (colunasRoteiros.dia_semana_reset && colunasRoteiros.hora_reset) {
            const [roteirosAntigos] = await sequelize.query(
              `SELECT id, dia_semana_reset, hora_reset FROM roteiros WHERE resets_agendados IS NULL`,
            );
            for (const linha of roteirosAntigos) {
              const resetsAgendados = JSON.stringify([
                {
                  diaSemana: Number(linha.dia_semana_reset ?? 0),
                  hora: linha.hora_reset || "23:59",
                },
              ]);
              await sequelize.query(
                `UPDATE roteiros SET resets_agendados = :resetsAgendados WHERE id = :id`,
                { replacements: { resetsAgendados, id: linha.id } },
              );
            }
            console.log(
              `✅ ${roteirosAntigos.length} roteiro(s) migrados para resets_agendados!`,
            );
          }

          await sequelize.query(
            `UPDATE roteiros SET resets_agendados = '[{"diaSemana":0,"hora":"23:59"}]' WHERE resets_agendados IS NULL`,
          );
          await queryInterface.changeColumn("roteiros", "resets_agendados", {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [{ diaSemana: 0, hora: "23:59" }],
          });
        }
      }

      if (tabelas.includes("roteiro_itens")) {
        const colunasRoteiroItens =
          await queryInterface.describeTable("roteiro_itens");
        if (!colunasRoteiroItens.concluido) {
          await queryInterface.addColumn("roteiro_itens", "concluido", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          });
          console.log("✅ Coluna concluido adicionada aos itens de roteiro!");
        }
        if (!colunasRoteiroItens.concluido_em) {
          await queryInterface.addColumn("roteiro_itens", "concluido_em", {
            type: DataTypes.DATE,
            allowNull: true,
          });
          console.log("✅ Coluna concluido_em adicionada aos itens de roteiro!");
        }
        if (!colunasRoteiroItens.maquinas_concluidas) {
          await queryInterface.addColumn(
            "roteiro_itens",
            "maquinas_concluidas",
            {
              type: DataTypes.JSON,
              allowNull: false,
              defaultValue: [],
            },
          );
          console.log(
            "✅ Coluna maquinas_concluidas adicionada aos itens de roteiro!",
          );
        }
      }

      if (tabelas.includes("compras")) {
        const colunasCompras = await queryInterface.describeTable("compras");
        if (!colunasCompras.pecaId) {
          await queryInterface.addColumn("compras", "pecaId", {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: "pecas", key: "id" },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          });
          console.log("✅ Coluna pecaId adicionada às compras!");
        }
        if (!colunasCompras.possuiPendencia) {
          await queryInterface.addColumn("compras", "possuiPendencia", {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          });
          console.log("✅ Coluna possuiPendencia adicionada às compras!");
        }
      }

      if (tabelas.includes("compra_itens")) {
        const colunasCompraItens =
          await queryInterface.describeTable("compra_itens");
        if (!colunasCompraItens.quantidade_recebida) {
          await queryInterface.addColumn(
            "compra_itens",
            "quantidade_recebida",
            {
              type: DataTypes.DECIMAL(10, 2),
              allowNull: true,
            },
          );
          console.log(
            "✅ Coluna quantidade_recebida adicionada aos itens de compra!",
          );
        }
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const colunasManutencoes =
        await queryInterface.describeTable("manutencoes");

      const colunasNovasManutencoes = [
        ["maquinaId", { type: DataTypes.UUID, allowNull: true }],
        ["responsavelId", { type: DataTypes.UUID, allowNull: true }],
        ["tipoProblema", { type: DataTypes.STRING(50), allowNull: true }],
        ["prazo", { type: DataTypes.DATEONLY, allowNull: true }],
        ["pecaPlanejadaId", { type: DataTypes.UUID, allowNull: true }],
        [
          "pecaPlanejadaFuncionarioId",
          { type: DataTypes.UUID, allowNull: true },
        ],
        ["pecaPlanejadaQuantidade", { type: DataTypes.INTEGER, allowNull: true }],
        ["pecaPlanejadaObservacao", { type: DataTypes.TEXT, allowNull: true }],
        [
          "pecaPlanejadaConsumida",
          { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
        ],
      ];

      for (const [nomeColuna, definicao] of colunasNovasManutencoes) {
        if (!colunasManutencoes[nomeColuna]) {
          await queryInterface.addColumn(
            "manutencoes",
            nomeColuna,
            definicao,
          );
          console.log(`✅ Coluna ${nomeColuna} adicionada às manutenções!`);
        }
      }

      // Nota: o sync() acima já adiciona os novos valores do ENUM sozinho
      // (ALTER TYPE ... ADD VALUE), então não dá pra usar "o valor novo já
      // existe" como sinal de que a migração já rodou. Em vez disso,
      // verificamos se os valores antigos ainda estão no tipo — assim que
      // o cleanup abaixo rodar uma vez, eles somem e o bloco não roda de novo.
      const [enumRows] = await sequelize.query(`
        SELECT e.enumlabel FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'enum_manutencoes_status'
      `);
      const statusLabels = enumRows.map((linha) => linha.enumlabel);

      if (statusLabels.includes("PENDENTE") || statusLabels.includes("RESOLVIDA")) {
        await sequelize.query(`
          ALTER TABLE manutencoes ALTER COLUMN status DROP DEFAULT;
          ALTER TABLE manutencoes ALTER COLUMN status TYPE VARCHAR(30) USING status::text;
          UPDATE manutencoes SET status = 'ABERTA' WHERE status = 'PENDENTE';
          UPDATE manutencoes SET status = 'CONCLUIDA' WHERE status = 'RESOLVIDA';
          DROP TYPE IF EXISTS "enum_manutencoes_status";
          CREATE TYPE "enum_manutencoes_status" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_PECA', 'CONCLUIDA');
          ALTER TABLE manutencoes ALTER COLUMN status TYPE "enum_manutencoes_status" USING status::"enum_manutencoes_status";
          ALTER TABLE manutencoes ALTER COLUMN status SET DEFAULT 'ABERTA';
        `);
        console.log("✅ Status das manutenções migrado para o novo fluxo!");
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const colunasPecas = await queryInterface.describeTable("pecas");

      if (!colunasPecas.quantidadeQuebrada) {
        await queryInterface.addColumn("pecas", "quantidadeQuebrada", {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        });
        console.log("✅ Coluna quantidadeQuebrada adicionada às peças!");
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const colunasNovasLojas = [
        [
          "status_operacao",
          {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: "ATIVA",
          },
        ],
        ["data_inicio", { type: DataTypes.DATEONLY, allowNull: true }],
        ["observacoes", { type: DataTypes.TEXT, allowNull: true }],
        [
          "data_vencimento_extintor",
          { type: DataTypes.DATEONLY, allowNull: true },
        ],
        ["data_fim_contrato", { type: DataTypes.DATEONLY, allowNull: true }],
        [
          "dias_aviso_contrato",
          { type: DataTypes.INTEGER, allowNull: true, defaultValue: 60 },
        ],
        [
          "contrato_aviso_adiado_dias",
          { type: DataTypes.INTEGER, allowNull: true },
        ],
      ];

      for (const [nomeColuna, definicao] of colunasNovasLojas) {
        if (!colunasLojas[nomeColuna]) {
          await queryInterface.addColumn("lojas", nomeColuna, definicao);
          console.log(`✅ Coluna ${nomeColuna} adicionada às lojas!`);
        }
      }
    }

    {
      // Migração de dados: lojas que já tinham um único vencimento de
      // extintor (coluna antiga data_vencimento_extintor) ganham o
      // equivalente como primeiro item da nova lista de extintores.
      // Idempotente: só cria se a loja ainda não tiver nenhum extintor
      // cadastrado na tabela nova.
      const { Op } = await import("sequelize");
      const { Loja, ExtintorLoja } = await import("./models/index.js");

      const lojasComExtintorAntigo = await Loja.findAll({
        where: { dataVencimentoExtintor: { [Op.ne]: null } },
        attributes: ["id", "dataVencimentoExtintor"],
      });

      for (const loja of lojasComExtintorAntigo) {
        const jaTemExtintor = await ExtintorLoja.count({
          where: { lojaId: loja.id },
        });

        if (!jaTemExtintor) {
          await ExtintorLoja.create({
            lojaId: loja.id,
            dataVencimento: loja.dataVencimentoExtintor,
          });
          console.log(`✅ Extintor migrado para a lista da loja ${loja.id}`);
        }
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const tabelas = await queryInterface.showAllTables();
      if (tabelas.includes("GastoFixoLoja")) {
        const colunasGastoFixoLoja =
          await queryInterface.describeTable("GastoFixoLoja");
        const colunasNovasGastoFixoLoja = [
          ["vigencia_inicio", { type: DataTypes.DATEONLY, allowNull: true }],
          ["vigencia_fim", { type: DataTypes.DATEONLY, allowNull: true }],
        ];

        for (const [nomeColuna, definicao] of colunasNovasGastoFixoLoja) {
          if (!colunasGastoFixoLoja[nomeColuna]) {
            await queryInterface.addColumn(
              "GastoFixoLoja",
              nomeColuna,
              definicao,
            );
            console.log(`✅ Coluna ${nomeColuna} adicionada aos gastos fixos de loja!`);
          }
        }
      }
    }

    {
      const { DataTypes } = await import("sequelize");
      const colunasRegistroDinheiro = await queryInterface.describeTable(
        "registro_dinheiro",
      );

      const colunasNovasRegistroDinheiro = [
        ["valorBlink", { type: DataTypes.DECIMAL(10, 2), allowNull: true, defaultValue: 0 }],
        ["valorEsperadoSistema", { type: DataTypes.DECIMAL(10, 2), allowNull: true }],
        ["diferenca", { type: DataTypes.DECIMAL(10, 2), allowNull: true }],
        ["contadoPorId", { type: DataTypes.UUID, allowNull: true }],
        ["conferidoPorId", { type: DataTypes.UUID, allowNull: true }],
        ["comprovanteUrl", { type: DataTypes.STRING(700), allowNull: true }],
        ["diferencaBlink", { type: DataTypes.DECIMAL(10, 2), allowNull: true }],
        ["alertaBlinkResolvidoEm", { type: DataTypes.DATE, allowNull: true }],
        ["alertaBlinkResolvidoPorId", { type: DataTypes.UUID, allowNull: true }],
      ];

      for (const [nomeColuna, definicao] of colunasNovasRegistroDinheiro) {
        if (!colunasRegistroDinheiro[nomeColuna]) {
          await queryInterface.addColumn(
            "registro_dinheiro",
            nomeColuna,
            definicao,
          );
          console.log(`✅ Coluna ${nomeColuna} adicionada a registro_dinheiro!`);
        }
      }
    }

    await sequelize.query(`
      ALTER TYPE "enum_movimentacoes_veiculos_tipo" ADD VALUE IF NOT EXISTS 'abastecimento';
    `);

    // A coluna "tipo" em produção é validada por uma CHECK constraint
    // (não pelo tipo enum acima), então ela também precisa ser atualizada
    // para aceitar o valor 'abastecimento'.
    await sequelize.query(`
      ALTER TABLE "movimentacoes_veiculos"
        DROP CONSTRAINT IF EXISTS "movimentacoes_veiculos_tipo_check";
      ALTER TABLE "movimentacoes_veiculos"
        ADD CONSTRAINT "movimentacoes_veiculos_tipo_check"
        CHECK (tipo IN ('retirada', 'devolucao', 'abastecimento'));
    `);

    const colunasGastoVariavel = await queryInterface.describeTable(
      "GastoVariavel",
    );
    if (!colunasGastoVariavel.usuarioId) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("GastoVariavel", "usuarioId", {
        type: DataTypes.UUID,
        allowNull: true,
      });
      console.log("✅ Coluna usuarioId adicionada a GastoVariavel!");
    }
    if (!colunasGastoVariavel.veiculoId) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("GastoVariavel", "veiculoId", {
        type: DataTypes.UUID,
        allowNull: true,
      });
      console.log("✅ Coluna veiculoId adicionada a GastoVariavel!");
    }


    const { Usuario } = await import("./models/index.js");
    const adminEmail = process.env.ADMIN_EMAIL || "admin@agarramais.com";
    const adminExistente = await Usuario.findOne({
      where: { email: adminEmail },
    });

    if (!adminExistente) {
      const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
      await Usuario.create({
        nome: "Administrador",
        email: adminEmail,
        senha: adminPassword,
        role: "ADMIN",
        telefone: "(11) 99999-9999",
        ativo: true,
      });
      console.log("✅ Usuário admin criado:", adminEmail);
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);

      // Agendar limpeza automática de dados antigos apenas quando explicitamente habilitada
      if (process.env.NODE_ENV === "production" && dataRetentionEnabled) {
        iniciarLimpezaAutomatica();
      } else {
        console.log("⏸️ Limpeza automática de dados antigos desativada");
      }
    });
  } catch (error) {
    console.error("❌ Erro ao conectar com o banco de dados:", error);
    process.exit(1);
  }
};

// Função para executar limpeza automática diariamente
const iniciarLimpezaAutomatica = async () => {
  const { limparDadosAntigos } = await import("./utils/dataRetention.js");

  const executarLimpeza = async () => {
    const agora = new Date();
    const horas = agora.getHours();

    // Executar apenas às 3h da manhã
    if (horas === 3) {
      console.log("🗑️  Executando limpeza automática de dados antigos...");
      try {
        await limparDadosAntigos();
      } catch (error) {
        console.error("❌ Erro na limpeza automática:", error);
      }
    }
  };

  // Executar a cada 1 hora para verificar se é 3h da manhã
  setInterval(executarLimpeza, 60 * 60 * 1000); // 1 hora em ms
  console.log("⏰ Limpeza automática agendada para 3h da manhã (diariamente)");
};

startServer();

export default app;
