import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    const flatUsers = users.map(user => ({
      ...user,
      roles: user.roles.map(ur => ur.role.name)
    }));

    res.json(flatUsers);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener usuarios" });
  }
};

export const createUser = async (req, res) => {
  try {
    const { name, email, password, roleName } = req.body;

    if (!name || !email || !password || !roleName) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        isVerified: true,
        isActive: true,
        roles: {
          create: {
            role: {
              connect: { name: roleName }
            }
          }
        }
      }
    });

    res.status(201).json({ message: "Usuario creado con éxito", user: newUser });
  } catch (error) {
    res.status(500).json({ error: "Error al crear usuario" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { name, email }
    });

    res.json({ message: "Usuario actualizado", user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { isActive: !user.isActive }
    });

    res.json({ message: `Usuario ${updatedUser.isActive ? 'activado' : 'desactivado'}` });
  } catch (error) {
    res.status(500).json({ error: "Error al cambiar estado del usuario" });
  }
};