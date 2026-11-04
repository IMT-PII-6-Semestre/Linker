import { Router } from 'express';
import * as controller from '../controllers/chat.controller.js';
import { autenticar, exigirTipo } from '../middlewares/autenticar.js';
import { assincrono } from '../middlewares/erro.js';

const router = Router();
const comPerfil = [autenticar, exigirTipo('candidato', 'empresa')];

router.get('/conversas', comPerfil, assincrono(controller.listar));
router.get('/conversas/:id', comPerfil, assincrono(controller.obter));
router.get('/conversas/:id/mensagens', comPerfil, assincrono(controller.mensagens));
router.post('/conversas/:id/mensagens', comPerfil, assincrono(controller.enviar));
router.delete('/conversas/:id', comPerfil, assincrono(controller.desfazer));
router.post('/conversas/:id/bloqueio', comPerfil, assincrono(controller.bloquear));
router.post('/conversas/:id/denuncia', comPerfil, assincrono(controller.denunciar));

export default router;
