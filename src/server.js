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
].filter(Boolean); // Remove undefined se FRONTEND_URL não estiver definida

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requisições sem origin (como mobile apps, Postman, curl)
      if (!origin) return callback(null, true);

      // Se estiver na lista de origens permitidas ou for "*"
      if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
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
    const colunasMaquinas = await queryInterface.describeTable("maquinas");
    const colunasLojas = await queryInterface.describeTable("lojas");

    {
      const { DataTypes } = await import("sequelize");
      if (colunasMaquinas.lojaId?.allowNull === false) {
        await queryInterface.changeColumn("maquinas", "lojaId", {
          type: DataTypes.UUID,
          allowNull: true,
          references: { model: "lojas", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        });
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
      ];

      for (const [nomeColuna, definicao] of colunasNovasLojas) {
        if (!colunasLojas[nomeColuna]) {
          await queryInterface.addColumn("lojas", nomeColuna, definicao);
          console.log(`✅ Coluna ${nomeColuna} adicionada às lojas!`);
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


