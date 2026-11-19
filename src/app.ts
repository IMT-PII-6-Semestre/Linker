import express from 'express';
import { tratarErro } from './middlewares/erro.js';
import adminRoutes from './routes/admin.routes.js';
import authRoutes from './routes/auth.routes.js';
import chatRoutes from './routes/chat.routes.js';
import feedRoutes from './routes/feed.routes.js';
import perfilRoutes from './routes/perfil.routes.js';

export const app = express();

app.use(express.json());

app.use('/api', authRoutes);
app.use('/api', perfilRoutes);
app.use('/api', feedRoutes);
app.use('/api', chatRoutes);
app.use('/api', adminRoutes);

// Middleware de erro registrado por último — antes das rotas, nunca é chamado.
app.use(tratarErro);
