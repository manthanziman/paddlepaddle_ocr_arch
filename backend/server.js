import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import ocrRouter from './ocr/OCRController.js';
import { loadOrientationModel } from './ocr/preprocessing/orientation.js';
import { initPaddleOcrEngine } from './ocr/OCRWorker.js'

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(cors());

  app.use('/graphql', express.json({ limit: '50mb' }), expressMiddleware(server));

  // Mount OCR REST API
  app.use('/api', ocrRouter);

  
  app.get('/health', (req, res) => {
    res.status(200).send('OCR GraphQL Backend is running healthy');
  });

  app.get('/health/live', (req, res) => {
    res.sendStatus(200);
  });

  // app.get('/health/ready', (req, res) => {
  //   if (isModelReady()) return res.sendStatus(200);
  //   return res.status(503).send('model not ready');
  // });

  // Load and warm up the orientation model before accepting traffic.
  try {
    await loadOrientationModel();
    await initPaddleOcrEngine();
    console.log('Orientation model loaded and warmed up — ready to accept requests');
  } catch (err) {
    console.error('Failed to load/warmup orientation model:', err);
    // Depending on your deployment strategy you may want to fail startup.
  }

  const PORT = process.env.PORT || 4000;
  await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve));
  console.log(`Server ready at http://localhost:${PORT}/graphql — REST API under /api`);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
