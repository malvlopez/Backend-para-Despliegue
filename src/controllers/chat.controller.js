import { PrismaClient } from '../generated/prisma/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { extractTextFromPDF } from '../services/pdf.service.js';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const processChatMessage = async (req, res) => {
    try {
    const { routeId, moduleId, message, sessionId } = req.body;
    const userId = req.user.id;

    let session;
    if (sessionId) {
      session = await prisma.chatSession.findUnique({ where: { id: parseInt(sessionId) } });
    } else {
      session = await prisma.chatSession.create({
        data: {
          userId,
          moduleId: moduleId ? parseInt(moduleId) : null,
          title: "Sesión de Tutoría IA"
        }
      });
    }

    await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'STUDENT',
        content: message
      }
    });

    let contextText = "Consulta general del estudiante.";

    if (moduleId) {
      const moduleData = await prisma.module.findUnique({
        where: { id: parseInt(moduleId) },
        include: {
          route: true,
          resources: {
            include: { resource: true }
          }
        }
      });

      if (moduleData) {
        contextText = `Módulo: ${moduleData.title}\nDescripción: ${moduleData.description}\nReglas de Evaluación de la Ruta: ${moduleData.route.evaluationRules || 'Ninguna'}\n\nContenido del material de estudio:\n`;

        for (const modRes of moduleData.resources) {
          if (modRes.resource.type === 'PDF' && modRes.resource.url) {
            const pdfText = await extractTextFromPDF(modRes.resource.url);
            contextText += `\n--- Documento: ${modRes.resource.title} ---\n${pdfText}\n`;
          }
        }
      }
    }

    const systemPrompt = `
      Eres un profesor titular de la Escuela Politécnica Nacional (EPN), específicamente de la ESFOT.
      Tu objetivo es evaluar a un estudiante de la Tecnología en Desarrollo de Software basándote ESTRICTAMENTE en este material:

      ${contextText}

      Reglas de Evaluación:
      1. Prohibido hacer preguntas de definiciones memorísticas o conceptos básicos.
      2. Plantea escenarios prácticos orientados a la resolución de problemas lógicos.
      3. Exige el análisis de código, arquitecturas de software, rendimiento o configuraciones de red, dependiendo del tema.
      4. Mantén un tono académico, riguroso y directo.
      5. Si el estudiante envía código para evaluar, revisa si cumple con buenas prácticas y responde con el mismo rigor.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt
    });

    const previousMessages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' }
    });

    const history = previousMessages.slice(0, -1).map(msg => ({
      role: msg.sender === 'STUDENT' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const aiResponseText = result.response.text();

    const aiMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        sender: 'AI',
        content: aiResponseText
      }
    });

    return res.status(200).json({
      sessionId: session.id,
      reply: aiMessage
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error interno al procesar el mensaje." });
  }
};