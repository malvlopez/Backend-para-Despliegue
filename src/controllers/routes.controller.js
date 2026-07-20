import { PrismaClient } from '../generated/prisma/index.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const prisma = new PrismaClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const createRoute = async (req, res) => {
  try {
    const { title, description, category, estimatedTime, difficulty, evaluationRules, modules, imageUrl } = req.body;
    const authorId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: "El título es obligatorio." });
    }

    const newRoute = await prisma.learningRoute.create({
      data: {
        title,
        description,
        category,
        imageUrl,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        difficulty,
        evaluationRules,
        authorId,
        isPublic: true,
        modules: {
          create: modules?.map((mod, index) => ({
            title: mod.title,
            description: mod.description,
            position: index + 1,
            resources: {
              create: mod.resourceIds?.map((resId, resIndex) => ({
                resourceId: parseInt(resId),
                position: resIndex + 1
              })) || []
            }
          })) || []
        }
      },
      include: {
        modules: {
          include: {
            resources: {
              include: {
                resource: true
              }
            }
          }
        }
      }
    });

    return res.status(201).json({ message: "Ruta de aprendizaje creada exitosamente", route: newRoute });
  } catch (error) {
    return res.status(500).json({ error: "Error al crear la ruta." });
  }
};

export const getRoutes = async (req, res) => {
  try {
    const routes = await prisma.learningRoute.findMany({
      where: {
        isPublic: true
      },
      include: {
        modules: {
          include: {
            resources: {
              include: {
                resource: true
              }
            }
          }
        }
      }
    });
    return res.json(routes);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener las rutas' });
  }
};

export const getRouteById = async (req, res) => {
  try {
    const { id } = req.params;
    const route = await prisma.learningRoute.findUnique({
      where: { id: parseInt(id) },
      include: {
        modules: {
          include: {
            resources: {
              include: {
                resource: true
              }
            }
          }
        }
      }
    });
    
    if (!route) return res.status(404).json({ error: 'Ruta no encontrada' });
    return res.json(route);
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor al obtener la ruta' });
  }
};

export const deleteRoute = async (req, res) => {
  try {
    const { id } = req.params;

    const existingRoute = await prisma.learningRoute.findUnique({ where: { id: parseInt(id) } });
    if (!existingRoute) {
      return res.status(404).json({ error: "Ruta no encontrada." });
    }

    await prisma.learningRoute.delete({ where: { id: parseInt(id) } });

    return res.status(200).json({ message: "Ruta eliminada correctamente." });
  } catch (error) {
    return res.status(500).json({ error: "Error al eliminar la ruta." });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, estimatedTime, difficulty, evaluationRules, modules, imageUrl } = req.body;

    const existingRoute = await prisma.learningRoute.findUnique({ where: { id: parseInt(id) } });
    if (!existingRoute) {
      return res.status(404).json({ error: "Ruta no encontrada." });
    }

    const updatedRoute = await prisma.learningRoute.update({
      where: { id: parseInt(id) },
      data: {
        title,
        description,
        category,
        imageUrl,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        difficulty,
        evaluationRules,
        modules: {
          deleteMany: {},
          create: modules?.map((mod, index) => ({
            title: mod.title,
            description: mod.description,
            position: index + 1,
            resources: {
              create: mod.resourceIds?.map((resId, resIndex) => ({
                resourceId: parseInt(resId),
                position: resIndex + 1
              })) || []
            }
          })) || []
        }
      },
      include: {
        modules: {
          include: {
            resources: {
              include: { resource: true }
            }
          }
        }
      }
    });

    return res.status(200).json({ message: "Ruta actualizada", route: updatedRoute });
  } catch (error) {
    return res.status(500).json({ error: "Error al actualizar la ruta." });
  }
};

export const generatePersonalizedRoute = async (req, res) => {
  try {
    const { topic, difficulty, additionalContext } = req.body;
    const authorId = req.user.id;
    const uploadedFile = req.file; 

    if (!topic) {
      return res.status(400).json({ error: "El tema es obligatorio para generar la ruta." });
    }

    const systemPrompt = `
      Eres un experto diseñador curricular de software de la Escuela Politécnica Nacional.
      El estudiante solicita aprender sobre: "${topic}".
      Nivel de dificultad exigido: "${difficulty}".
      Contexto adicional proporcionado: "${additionalContext || 'Ninguno'}".

      Instrucciones estrictas:
      1. Diseña una Ruta de Aprendizaje completa y estructurada en módulos.
      2. DEBES incluir recursos educativos reales para CADA módulo. Inventa un título descriptivo y proporciona una URL que sepas que existe.
      3. El campo "evaluationRules" será el PROMPT MAESTRO para evaluar a este estudiante en el futuro.
      4. Devuelve ÚNICAMENTE un objeto JSON válido con la siguiente estructura exacta:

      {
        "title": "Un título atractivo",
        "description": "Una descripción clara",
        "evaluationRules": "Reglas estrictas de evaluación",
        "modules": [
          {
            "title": "Nombre del módulo",
            "description": "Descripción detallada",
            "resources": [
              {
                "title": "Nombre del recurso",
                "url": "https://enlace-real.com",
                "type": "DOCUMENT"
              }
            ]
          }
        ]
      }
    `;

    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    const promptParts = [systemPrompt];

    if (uploadedFile) {
      promptParts.push({
        inlineData: {
          data: uploadedFile.buffer.toString("base64"),
          mimeType: uploadedFile.mimetype
        }
      });
    }

    const result = await model.generateContent(promptParts);
    let aiResponse = result.response.text().trim();
    aiResponse = aiResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
    
    const parsedData = JSON.parse(aiResponse);

    const newRoute = await prisma.learningRoute.create({
      data: {
        title: parsedData.title,
        description: parsedData.description,
        category: "Generada por IA",
        difficulty: difficulty || "INTERMEDIATE",
        evaluationRules: parsedData.evaluationRules,
        authorId,
        isPublic: false, 
        modules: {
          create: parsedData.modules.map((mod, modIndex) => ({
            title: mod.title,
            description: mod.description,
            position: modIndex + 1,
            resources: {
              create: mod.resources?.map((res, resIndex) => ({
                position: resIndex + 1,
                resource: {
                  create: {
                    title: res.title,
                    url: res.url,
                    type: res.type || "DOCUMENT",
                    authorId 
                  }
                }
              })) || []
            }
          }))
        }
      },
      include: { 
        modules: {
          include: {
            resources: {
              include: { resource: true }
            }
          }
        }
      }
    });

    return res.status(201).json({ message: "Ruta IA generada exitosamente", route: newRoute });
  } catch (error) {
    return res.status(500).json({ error: "Fallo al generar la ruta personalizada con IA." });
  }
};

export const getMyRoutes = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrolledRoutes = await prisma.learningRoute.findMany({
      where: {
        enrollments: {
          some: { userId: userId }
        }
      },
      include: {
        modules: { include: { resources: { include: { resource: true } } } }
      }
    });

    const authoredRoutes = await prisma.learningRoute.findMany({
      where: {
        authorId: userId,
        isPublic: false 
      },
      include: {
        modules: { include: { resources: { include: { resource: true } } } }
      }
    });

    const combinedRoutesMap = new Map();
    [...enrolledRoutes, ...authoredRoutes].forEach(route => {
      combinedRoutesMap.set(route.id, route);
    });

    const finalRoutes = Array.from(combinedRoutesMap.values());

    return res.json(finalRoutes);
  } catch (error) {
    return res.status(500).json({ error: 'Error al obtener tus rutas.' });
  }
};

export const enrollRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const routeId = parseInt(id);

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_learningRouteId: {
          userId,
          learningRouteId: routeId
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: "Ya estás inscrito en esta ruta." });
    }

    const newEnrollment = await prisma.enrollment.create({
      data: {
        userId,
        learningRouteId: routeId
      }
    });

    return res.status(201).json({ message: "Inscripción exitosa.", enrollment: newEnrollment });
  } catch (error) {
    return res.status(500).json({ error: 'Error al inscribirse en la ruta.' });
  }
};