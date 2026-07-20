import { PrismaClient } from '../generated/prisma/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prepareResourceForGemini } from '../services/resourceParser.service.js';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const updateStudentProfile = async (userId, studentMessage, aiMessage, currentProfile) => {
  try {
    const analysisPrompt = `
      Analiza la siguiente interacción entre un estudiante y un tutor de la Escuela Politécnica Nacional.
      Mensaje del estudiante: "${studentMessage}"
      Respuesta del tutor: "${aiMessage}"
      Perfil de aprendizaje actual del estudiante: "${currentProfile || 'No definido aún.'}"
      
      Actualiza el perfil de aprendizaje sintetizando su nivel de comprensión, dudas recurrentes y estilo preferido.
      Devuelve ÚNICAMENTE el texto actualizado del perfil de forma concisa.
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const result = await model.generateContent(analysisPrompt);
    const updatedProfile = result.response.text().trim();

    await prisma.user.update({
      where: { id: userId },
      data: { learningProfile: updatedProfile }
    });
  } catch (error) {
    console.error("ERROR ACTUALIZANDO PERFIL DE APRENDIZAJE:", error);
  }
};

export const processChatMessage = async (req, res) => {
  try {
    const { routeId, moduleId, message, sessionId } = req.body;
    const userId = req.user.id;

    const user = await prisma.user.findUnique({ where: { id: userId } });

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

        const resourcePromises = moduleData.resources.map(modRes => 
          prepareResourceForGemini(modRes.resource)
        );
        
        const parsedResources = await Promise.all(resourcePromises);
        let combinedResources = parsedResources.join('\n');

        if (combinedResources.length > 150000) {
          combinedResources = combinedResources.substring(0, 150000) + "\n\n[Contenido truncado por límite de seguridad]";
        }

        contextText += combinedResources;
      }
    }

    const systemPrompt = `
      Eres un profesor titular de la Escuela Politécnica Nacional (EPN), específicamente de la ESFOT.
      Tu objetivo es evaluar y guiar al estudiante basándote ESTRICTAMENTE en este material:

      ${contextText}

      Contexto de aprendizaje dinámico de este estudiante:
      ${user.learningProfile || 'Estudiante nuevo, adapta tu estilo progresivamente.'}

      Reglas de Evaluación:
      1. Adapta tus explicaciones al contexto de aprendizaje dinámico proporcionado.
      2. Prohibido hacer preguntas de definiciones memorísticas o conceptos básicos.
      3. Plantea escenarios prácticos orientados a la resolución de problemas lógicos.
      4. Exige el análisis de código, arquitecturas de software, rendimiento o configuraciones de red, dependiendo del tema.
      5. Mantén un tono académico, riguroso y directo.
      6. Si el estudiante envía código para evaluar, revisa si cumple con buenas prácticas y responde con el mismo rigor.
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
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

    updateStudentProfile(userId, message, aiResponseText, user.learningProfile);

    return res.status(200).json({
      sessionId: session.id,
      reply: aiMessage
    });
  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: "Límite de peticiones de IA alcanzado." });
    }
    return res.status(500).json({ error: "Error interno al procesar el mensaje." });
  }
};

export const generateModuleAssessment = async (req, res) => {
  try {
    const { moduleId } = req.body;

    const moduleData = await prisma.module.findUnique({
      where: { id: parseInt(moduleId) },
      include: {
        route: true,
        resources: {
          include: { resource: true }
        }
      }
    });

    if (!moduleData) {
      return res.status(404).json({ error: "Módulo no encontrado." });
    }

    let contextText = `Módulo: ${moduleData.title}\nReglas de Evaluación (Prompt Maestro): ${moduleData.route.evaluationRules || 'Ninguna'}\n\nContenido de los recursos:\n`;

    const resourcePromises = moduleData.resources.map(modRes => 
      prepareResourceForGemini(modRes.resource)
    );
    const parsedResources = await Promise.all(resourcePromises);
    let combinedResources = parsedResources.join('\n');

    if (combinedResources.length > 150000) {
      combinedResources = combinedResources.substring(0, 150000) + "\n\n[Contenido truncado por límite de seguridad]";
    }

    contextText += combinedResources;

    const systemPrompt = `
      Eres un profesor exigente de la EPN. Tu objetivo es crear una prueba para evaluar a un estudiante basándote EXCLUSIVAMENTE en el siguiente material y aplicando las reglas del Prompt Maestro.

      ${contextText}

      Instrucciones obligatorias:
      1. Genera exactamente 5 preguntas (3 de opción múltiple y 2 de verdadero/falso).
      2. Las preguntas de verdadero/falso deben contener afirmaciones que requieran análisis, no definiciones obvias.
      3. Devuelve ÚNICAMENTE un objeto JSON con la estructura exacta que se muestra abajo, sin texto adicional, sin saludos, solo el JSON puro.

      Estructura requerida:
      {
        "questions": [
          {
            "id": 1,
            "type": "multiple_choice",
            "question": "¿Pregunta de opción múltiple?",
            "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
            "correctAnswer": "Opción A",
            "explanation": "Explicación técnica de por qué es la respuesta correcta."
          },
          {
            "id": 2,
            "type": "true_false",
            "question": "¿Afirmación a evaluar?",
            "options": ["Verdadero", "Falso"],
            "correctAnswer": "Verdadero",
            "explanation": "Explicación técnica del porqué de la veracidad."
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: systemPrompt
    });

    const chat = model.startChat();
    const result = await chat.sendMessage("Genera la evaluación ahora. Recuerda responder SOLAMENTE con el JSON, sin bloques de código markdown extra.");
    let aiResponseText = result.response.text();

    aiResponseText = aiResponseText.replace(/```json/gi, '').replace(/```/gi, '').trim();

    try {
      const parsedJSON = JSON.parse(aiResponseText);
      return res.status(200).json(parsedJSON);
    } catch (parseError) {
      return res.status(500).json({ error: "La IA devolvió un formato inválido. Intenta de nuevo." });
    }

  } catch (error) {
    if (error.status === 429) {
      return res.status(429).json({ error: "Límite de peticiones de IA alcanzado." });
    }
    return res.status(500).json({ error: "Error al generar la prueba dinámica." });
  }
};