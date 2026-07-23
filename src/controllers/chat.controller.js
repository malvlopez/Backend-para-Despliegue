import prisma from '../prisma.js';
import Pusher from 'pusher';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prepareResourceForGemini } from '../services/resourceParser.service.js';

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
  } catch (error) {}
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
    const { moduleId, type = 'completa' } = req.body;

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

    let promptInstructions = "";
    let fewShotExample = "";

    const practicalRules = `
        IMPORTANTE PARA EL RETO PRÁCTICO: El editor de la plataforma es un lienzo de evidencias multitarea.
        Indica explícitamente al estudiante que seleccione la opción "Markdown / Texto Libre" en el editor para redactar su respuesta estructurando bloques de código (bash, json, html, sql, etc) o que suba imágenes/archivos al entorno.
    `;

    if (type === 'teoria') {
      promptInstructions = `
        Instrucciones obligatorias:
        1. Genera EXACTAMENTE 5 preguntas.
        2. Todas las preguntas DEBEN ser de "multiple_choice" o "true_false".
        3. Las preguntas de verdadero/falso deben requerir análisis técnico.
      `;
      fewShotExample = `
      {
        "questions": [
          {
            "id": 1,
            "type": "multiple_choice",
            "question": "¿Cuál es la principal ventaja de...?",
            "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
            "correctAnswer": "Opción A",
            "explanation": "Explicación detallada."
          },
          {
            "id": 2,
            "type": "true_false",
            "question": "El protocolo TCP no garantiza la entrega de paquetes.",
            "options": ["Verdadero", "Falso"],
            "correctAnswer": "Falso",
            "explanation": "TCP es orientado a conexión y garantiza la entrega mediante acuses de recibo."
          }
        ]
      }
      `;
    } else if (type === 'practica') {
      promptInstructions = `
        Instrucciones obligatorias:
        1. Genera un "practicalChallenge" SENCILLO y DIRECTO.
        2. DEBE tener UNA SOLA TAREA ("tasks" de longitud 1). No generes proyectos integradores.
        ${practicalRules}
      `;
      fewShotExample = `
      {
        "practicalChallenge": {
          "title": "Reto Práctico Rápido: Inicialización",
          "context": "Contexto breve sobre la inicialización de la herramienta descrita en el módulo.",
          "tasks": [
            { "id": "t1", "description": "Escribe el comando exacto para iniciar el proyecto según la documentación." }
          ]
        }
      }
      `;
    } else {
      promptInstructions = `
        Instrucciones obligatorias:
        1. Genera ENTRE 10 Y 15 PREGUNTAS ("multiple_choice" o "true_false").
        2. Genera un "practicalChallenge" que sea un RETO FINAL INTEGRADOR complejo.
        3. El reto práctico debe estar desglosado en un arreglo de 3 a 5 tareas independientes.
        ${practicalRules}
      `;
      fewShotExample = `
      {
        "questions": [
          {
            "id": 1,
            "type": "multiple_choice",
            "question": "¿Pregunta compleja 1?",
            "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
            "correctAnswer": "Opción A",
            "explanation": "Explicación técnica."
          }
        ],
        "practicalChallenge": {
          "title": "Reto Final Integrador",
          "context": "Descripción general de la arquitectura o sistema a desarrollar...",
          "tasks": [
            { "id": "t1", "description": "Paso 1: Configuración base..." },
            { "id": "t2", "description": "Paso 2: Desarrollo del script principal..." },
            { "id": "t3", "description": "Paso 3: Análisis de la implementación..." }
          ]
        }
      }
      `;
    }

    const systemPrompt = `
      Eres un profesor exigente de la EPN. Tu objetivo es crear material de evaluación para un estudiante basándote EXCLUSIVAMENTE en el siguiente material y aplicando las reglas del Prompt Maestro.

      ${contextText}

      ${promptInstructions}

      Devuelve ÚNICAMENTE un objeto JSON. No incluyas markdown como \`\`\`json, ni texto adicional, ni saludos.
      
      EJEMPLO DE ESTRUCTURA Y FORMATO ESPERADO:
      ${fewShotExample}
    `;

    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      systemInstruction: systemPrompt
    });

    const chat = model.startChat();
    const result = await chat.sendMessage("Genera la evaluación solicitada ahora. Recuerda responder SOLAMENTE con el JSON puro.");
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

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true
});

export const sendMessage = async (req, res) => {
  try {
    const { user, role, message, timestamp } = req.body;
    
    await pusher.trigger('esfot-support-channel', 'new-message', {
      user,
      role,
      message,
      timestamp
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: "Fallo al retransmitir el mensaje" });
  }
};
