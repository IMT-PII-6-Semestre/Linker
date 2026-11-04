import { Router } from 'express';
import * as controller from '../controllers/feed.controller.js';
import { autenticar, exigirTipo } from '../middlewares/autenticar.js';
import { assincrono } from '../middlewares/erro.js';

const router = Router();
const comPerfil = [autenticar, exigirTipo('candidato', 'empresa')];

router.get('/feed', comPerfil, assincrono(controller.listar));
router.post('/swipe', comPerfil, assincrono(controller.curtir));

export default router;
