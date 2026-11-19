import { Router } from 'express';
import * as perfil from '../controllers/perfil.controller.js';
import * as vaga from '../controllers/vaga.controller.js';
import { autenticar, exigirTipo } from '../middlewares/autenticar.js';
import { assincrono } from '../middlewares/erro.js';

const router = Router();
const comPerfil = [autenticar, exigirTipo('candidato', 'empresa')];
const soEmpresa = [autenticar, exigirTipo('empresa')];

router.get('/perfil', comPerfil, assincrono(perfil.obter));
router.put('/perfil', comPerfil, assincrono(perfil.atualizar));
router.post('/vagas', soEmpresa, assincrono(vaga.criar));
router.put('/vagas/:id', soEmpresa, assincrono(vaga.editar));
router.delete('/vagas/:id', soEmpresa, assincrono(vaga.remover));

export default router;
