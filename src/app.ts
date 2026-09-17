import express from 'express';
import { tratarErro } from './middlewares/erro.js';
import authRoutes from './routes/auth.routes.js';

export const app = express();

app.use(express.json());

app.use('/api', authRoutes);

// Middleware de erro registrado por último — antes das rotas, nunca é chamado.
app.use(tratarErro);
