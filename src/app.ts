import express from 'express';
import { pastaUploads } from './config/env.js';
import { tratarErro } from './middlewares/erro.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import feedRoutes from './routes/feed.routes.js';
import perfilRoutes from './routes/perfil.routes.js';

export const app = express();

app.use(express.json());

app.use('/uploads', express.static(pastaUploads));
app.use('/api', authRoutes);
app.use('/api', perfilRoutes);
app.use('/api', feedRoutes);
app.use('/api', chatRoutes);

// Middleware de erro registrado por último — antes das rotas, nunca é chamado.
app.use(tratarErro);
