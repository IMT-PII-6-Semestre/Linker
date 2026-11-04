import { Router } from 'express';
import * as controller from '../controllers/admin.controller.js';
import { autenticar, exigirTipo } from '../middlewares/autenticar.js';
import { assincrono } from '../middlewares/erro.js';

const router = Router();

router.get('/admin/snapshot', autenticar, exigirTipo('admin'), assincrono(controller.snapshot));

export default router;
