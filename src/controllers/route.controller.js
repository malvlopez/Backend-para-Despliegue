import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

export const createRoute = async (req, res) => {
  try {
    const { title, description, category, estimatedTime, difficulty, evaluationRules, resourceIds } = req.body;
    const authorId = req.user.id;

    if (!title) {
      return res.status(400).json({ error: "El título es obligatorio." });
    }

    const newRoute = await prisma.learningRoute.create({
      data: {
        title,
        description,
        category,
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        difficulty,
        evaluationRules,
        authorId,
        resources: {
          create: resourceIds?.map((id, index) => ({
            resourceId: parseInt(id),
            position: index + 1
          })) || []
        }
      },
      include: {
        resources: {
          include: {
            resource: true
          }
        }
      }
    });

    return res.status(201).json({ message: "Ruta de aprendizaje creada exitosamente", route: newRoute });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al crear la ruta." });
  }
};

export const getRoutes = async (req, res) => {
  try {
    const routes = await prisma.learningRoute.findMany({
      include: {
        author: {
          select: { name: true, email: true }
        },
        resources: {
          orderBy: { position: 'asc' },
          include: {
            resource: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(routes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener las rutas." });
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
    console.error(error);
    return res.status(500).json({ error: "Error al eliminar la ruta." });
  }
};

export const updateRoute = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, category, estimatedTime, difficulty, evaluationRules, resourceIds } = req.body;

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
        estimatedTime: estimatedTime ? parseInt(estimatedTime) : null,
        difficulty,
        evaluationRules,
        resources: {
          deleteMany: {},
          create: resourceIds?.map((id, index) => ({
            resourceId: parseInt(id),
            position: index + 1
          })) || []
        }
      },
      include: {
        resources: {
          include: { resource: true }
        }
      }
    });

    return res.status(200).json({ message: "Ruta actualizada", route: updatedRoute });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al actualizar la ruta." });
  }
};