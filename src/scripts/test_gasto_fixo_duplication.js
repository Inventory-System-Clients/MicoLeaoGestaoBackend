import { sequelize } from "../database/connection.js";
import {
  Loja,
  GastoFixoLoja,
  RegistroDinheiro,
  GastoTotalFixoLoja,
} from "../models/index.js";
import { calcularGastoFixoProporcionalPeriodo } from "../controllers/relatorioController.js";

const run = async () => {
  try {
    // Encontrar uma loja existente
    const loja = await Loja.findOne({ raw: true });
    if (!loja) {
      console.error("Nenhuma loja encontrada no banco de dados.");
      return;
    }

    const lojaId = loja.id;
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth() + 1;
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0, 23, 59, 59, 999);

    // Limpar registros de teste anteriores (por segurança)
    await RegistroDinheiro.destroy({
      where: {
        lojaId,
        inicio,
        fim,
      },
    });
    await GastoFixoLoja.destroy({
      where: { lojaId, nome: "__TEST_GASTO_FIXO__" },
    });
    await GastoTotalFixoLoja.destroy({ where: { lojaId, ano, mes } });

    // Criar gasto fixo de 1000
    await GastoFixoLoja.create({
      lojaId,
      nome: "__TEST_GASTO_FIXO__",
      valor: 1000,
      observacao: "Teste de duplicação",
    });

    // Criar dois registros de dinheiro para o mesmo mês
    const payload = {
      lojaId,
      registrarTotalLoja: true,
      inicio,
      fim,
      valorDinheiro: 0,
      valorCartaoPix: 0,
      valorCartaoPixLiquido: 0,
      taxaDeCartao: 0,
      percentualTaxaCartaoMedia: 0,
      valorBlink: 0,
      valorEsperadoSistema: 0,
      diferenca: 0,
      contadoPorId: null,
      conferidoPorId: null,
      comprovanteUrl: null,
      gastoFixoPeriodo: 1000,
      gastoVariavelPeriodo: 0,
      gastoProdutosPeriodo: 0,
      gastoTotalPeriodo: 1000,
      observacoes: "Teste",
    };

    await RegistroDinheiro.create(payload);
    await RegistroDinheiro.create(payload);

    // Calcular gasto fixo proporcional no período
    const resultado = await calcularGastoFixoProporcionalPeriodo(
      lojaId,
      inicio,
      fim,
    );

    console.log("Resultado do cálculo proporcional de gasto fixo:", resultado);

    // Verificar o que está salvo em GastoTotalFixoLoja
    const totalSalvo = await GastoTotalFixoLoja.findOne({
      where: { lojaId, ano, mes },
      raw: true,
    });
    console.log("Registro em GastoTotalFixoLoja:", totalSalvo);

    // Limpeza dos dados de teste
    await RegistroDinheiro.destroy({ where: { lojaId, inicio, fim } });
    await GastoFixoLoja.destroy({
      where: { lojaId, nome: "__TEST_GASTO_FIXO__" },
    });
    if (totalSalvo)
      await GastoTotalFixoLoja.destroy({ where: { id: totalSalvo.id } });
  } catch (err) {
    console.error("Erro no teste:", err);
  } finally {
    try {
      await sequelize.close();
    } catch {}
  }
};

run();
