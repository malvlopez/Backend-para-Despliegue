import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import resourceRoutes from './routes/resource.routes.js';
import routeRoutes from './routes/route.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import chatRoutes from './routes/chat.routes.js';
import { initializeFirstAdmin } from './services/init.service.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use('/api/resources', resourceRoutes);
app.use('/api/routes', routeRoutes);

app.use('/api/upload', uploadRoutes);

app.use('/api/chat', chatRoutes);

app.get("/", (req, res) => {
  res.send("API funcionando");
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await initializeFirstAdmin();
  
  app.listen(PORT, () => {
    console.log(`Servidor en puerto ${PORT}`);
  });
};

startServer();