import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from './routes/auth.routes.js';
import { initializeFirstAdmin } from './services/init.service.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);

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