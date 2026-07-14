import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

export const createResource = async (req, res) => {
  try {
    const { title, description, type, url } = req.body;
    const authorId = req.user.id;

    if (!title || !type || !url) {
      return res.status(400).json({ error: "Título, tipo y URL son obligatorios." });
    }

    const newResource = await prisma.resource.create({
      data: {
        title,
        description,
        type,
        url,
        authorId
      }
    });

    return res.status(201).json({ message: "Recurso creado exitosamente", resource: newResource });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al crear el recurso." });
  }
};

export const getResources = async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      include: {
        author: {
          select: { name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(resources);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al obtener los recursos." });
  }
};

export const updateResource = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, url } = req.body;

    const existingResource = await prisma.resource.findUnique({ where: { id: parseInt(id) } });
    if (!existingResource) {
      return res.status(404).json({ error: "Recurso no encontrado." });
    }

    const updatedResource = await prisma.resource.update({
      where: { id: parseInt(id) },
      data: { title, description, type, url }
    });

    return res.status(200).json({ message: "Recurso actualizado", resource: updatedResource });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al actualizar el recurso." });
  }
};

export const deleteResource = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResource = await prisma.resource.findUnique({ where: { id: parseInt(id) } });
    if (!existingResource) {
      return res.status(404).json({ error: "Recurso no encontrado." });
    }

    await prisma.resource.delete({ where: { id: parseInt(id) } });

    return res.status(200).json({ message: "Recurso eliminado correctamente." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al eliminar el recurso." });
  }
};