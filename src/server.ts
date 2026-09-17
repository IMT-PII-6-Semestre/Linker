import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.porta, () => {
  console.log(`Linker backend ouvindo na porta ${env.porta}`);
});
