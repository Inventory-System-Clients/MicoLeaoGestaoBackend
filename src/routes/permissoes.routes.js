import express from "express";
import { obterCatalogo } from "../controllers/permissoesController.js";
import { autenticar, autorizarRole } from "../middlewares/auth.js";

const router = express.Router();

router.get("/catalogo", autenticar, autorizarRole("ADMIN"), obterCatalogo);

export default router;
