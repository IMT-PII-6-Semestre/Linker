import { Router } from 'express';
import * as controller from '../controllers/auth.controller.js';
import { assincrono } from '../middlewares/erro.js';

const router = Router();

router.post('/auth/cadastro/candidato', assincrono(controller.cadastrarCandidato));
router.post('/auth/cadastro/empresa', assincrono(controller.cadastrarEmpresa));
router.post('/auth/login', assincrono(controller.login));

export default router;
