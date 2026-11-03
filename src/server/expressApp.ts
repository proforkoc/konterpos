import express from 'express';
import { apiRouter } from './api.ts';

export const createExpressApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);
  return app;
};

export const expressApp = createExpressApp();
