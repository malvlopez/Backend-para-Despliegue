import { PrismaClient } from '../generated/prisma/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const processChatMessage = async (req, res) => {
  try {
    const { routeId, message, sessionId } = req.body;
    const userId = req.user.id;

    if (!routeId || !message) {
      return res.status(400).json({ error: "Faltan datos obligatorios." });
    }

    const route = await prisma.learningRoute.findUnique({
      where: { id: parseInt(routeId) }
    });

    if (!route) {
      return res.status(404).json({ error: "Ruta no encontrada." });
    }

    let currentSessionId = sessionId ? parseInt(sessionId) : null;

    if (!currentSessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          userId,
          title: `Tutoría: ${route.title}`,
          topic: route.title
        }
      });
      currentSessionId = newSession.id;
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        sender: "STUDENT",
        content: message
      }
    });

    const history = await prisma.chatMessage.findMany({
      where: { sessionId: currentSessionId },
      orderBy: { createdAt: 'asc' }
    });

    const formattedHistory = history.map(msg => ({
      role: msg.sender === "STUDENT" ? "user" : "model",
      parts: [{ text: msg.content }]
    }));

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: route.evaluationRules || "Eres un tutor académico de la EPN. Ayuda al estudiante."
    });

    const chat = model.startChat({
      history: formattedHistory.slice(0, -1)
    });

    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    const savedAiMessage = await prisma.chatMessage.create({
      data: {
        sessionId: currentSessionId,
        sender: "AI",
        content: aiResponse
      }
    });

    return res.status(200).json({
      sessionId: currentSessionId,
      reply: savedAiMessage
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error de comunicación con el motor de IA." });
  }
};