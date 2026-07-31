import { GastoTotalFixoLoja } from "../models/index.js";
import { GastoFixoLoja } from "../models/index.js";
import { sequelize } from "../database/connection.js";

const run = async () => {
  try {
    const resultados = await GastoTotalFixoLoja.findAll({
      order: [
        ["ano", "DESC"],
        ["mes", "DESC"],
      ],
      limit: 50,
      raw: true,
    });

    console.log(JSON.stringify(resultados, null, 2));
    console.log("--- GastoTotalFixoLoja ---");
    if (resultados.length > 0) {
      const lojaId = resultados[0].lojaId;
      const gastos = await GastoFixoLoja.findAll({
        where: { lojaId },
        raw: true,
      });
      console.log(`--- GastoFixoLoja for lojaId=${lojaId} ---`);
      console.log(JSON.stringify(gastos, null, 2));
    }
  } catch (err) {
    console.error("Erro ao consultar GastoTotalFixoLoja:", err.message);
  } finally {
    try {
      await sequelize.close();
    } catch {}
  }
};

run();
