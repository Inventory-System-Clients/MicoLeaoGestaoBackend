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
    contentSecurityPolicy: false, // Permitir recursos inline para a pÃ¡gina de relatÃ³rio
  }),
);

// Configurar CORS para aceitar localhost e produÃ§Ã£o
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  "https://agarramaisop.selfmachine.com.br",
  "https://grupogk.selfmachine.com.br",
  process.env.FRONTEND_URL,
].filter(Boolean); // Remove undefined se FRONTEND_URL nÃ£o estiver definida

app.use(
  cors({
    origin: function (origin, callback) {
      // Permitir requisiÃ§Ãµes sem origin (como mobile apps, Postman, curl)
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

// Servir arquivos estÃ¡ticos da pasta public
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

// Debug endpoint - remover em produÃ§Ã£o
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
    console.log("âœ… ConexÃ£o com PostgreSQL estabelecida com sucesso!");

    // Sync database - cria novas tabelas/colunas mas nÃ£o altera existentes
    // Para evitar erros de sintaxe SQL ao adicionar constraints
    await sequelize.sync();
    console.log("âœ… Database sincronizado!");

    const queryInterface = sequelize.getQueryInterface();
    const colunasMaquinas = await queryInterface.describeTable("maquinas");

    // Criar admin padrÃ£o se nÃ£o existir
    if (!colunasMaquinas.jogadas_boas_por_pelucia) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("maquinas", "jogadas_boas_por_pelucia", {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: "Quantidade ideal de jogadas para sair uma pelÃƒÂºcia",
      });
      console.log(
        "Ã¢Å“â€¦ Coluna de jogadas boas por pelÃƒÂºcia adicionada ÃƒÂ s mÃƒÂ¡quinas!",
      );
    }



    await sequelize.query(`
      ALTER TYPE "enum_movimentacoes_veiculos_tipo" ADD VALUE IF NOT EXISTS 'abastecimento';
    `);

    // A coluna "tipo" em produÃ§Ã£o Ã© validada por uma CHECK constraint
    // (nÃ£o pelo tipo enum acima), entÃ£o ela tambÃ©m precisa ser atualizada
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
      console.log("âœ… Coluna usuarioId adicionada a GastoVariavel!");
    }
    if (!colunasGastoVariavel.veiculoId) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("GastoVariavel", "veiculoId", {
        type: DataTypes.UUID,
        allowNull: true,
      });
      console.log("âœ… Coluna veiculoId adicionada a GastoVariavel!");
    }

    const colunasSuporteMovimentacoes = await queryInterface.describeTable(
      "suporte_movimentacoes",
    );
    if (!colunasSuporteMovimentacoes.categoria) {
      const { DataTypes } = await import("sequelize");
      await queryInterface.addColumn("suporte_movimentacoes", "categoria", {
        type: DataTypes.ENUM("VENDA", "TROCA", "COMPRA", "DEVOLUCAO"),
        allowNull: true,
      });
      console.log("âœ… Coluna categoria adicionada a suporte_movimentacoes!");
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
      console.log("âœ… UsuÃ¡rio admin criado:", adminEmail);
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`ðŸš€ Servidor rodando na porta ${PORT}`);
      console.log(`ðŸ“ http://localhost:${PORT}`);
      console.log(`ðŸ¥ Health check: http://localhost:${PORT}/health`);

      // Agendar limpeza automÃ¡tica de dados antigos apenas quando explicitamente habilitada
      if (process.env.NODE_ENV === "production" && dataRetentionEnabled) {
        iniciarLimpezaAutomatica();
      } else {
        console.log("â¸ï¸ Limpeza automÃ¡tica de dados antigos desativada");
      }
    });
  } catch (error) {
    console.error("âŒ Erro ao conectar com o banco de dados:", error);
    process.exit(1);
  }
};

// FunÃ§Ã£o para executar limpeza automÃ¡tica diariamente
const iniciarLimpezaAutomatica = async () => {
  const { limparDadosAntigos } = await import("./utils/dataRetention.js");

  const executarLimpeza = async () => {
    const agora = new Date();
    const horas = agora.getHours();

    // Executar apenas Ã s 3h da manhÃ£
    if (horas === 3) {
      console.log("ðŸ—‘ï¸  Executando limpeza automÃ¡tica de dados antigos...");
      try {
        await limparDadosAntigos();
      } catch (error) {
        console.error("âŒ Erro na limpeza automÃ¡tica:", error);
      }
    }
  };

  // Executar a cada 1 hora para verificar se Ã© 3h da manhÃ£
  setInterval(executarLimpeza, 60 * 60 * 1000); // 1 hora em ms
  console.log("â° Limpeza automÃ¡tica agendada para 3h da manhÃ£ (diariamente)");
};

startServer();

export default app;

