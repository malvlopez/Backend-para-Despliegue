import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/index.js';

const prisma = new PrismaClient();

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Acceso denegado. No se proporcionó un token." });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(401).json({ error: "Token inválido o expirado." });
  }
};

export const checkRoles = (allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(403).json({ error: "No tienes permisos para realizar esta acción." });
      }

      const rawId = req.user.id || req.user.userId || req.user.sub;
      const userId = parseInt(rawId);

      if (!userId || isNaN(userId)) {
        return res.status(403).json({ error: "Acceso denegado. ID inválido en el token." });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } }
      });

      if (!dbUser) {
        return res.status(403).json({ error: "Acceso denegado. Usuario no encontrado en la DB." });
      }

      if (!dbUser.roles || dbUser.roles.length === 0) {
        return res.status(403).json({ error: "Acceso denegado. El usuario no tiene roles." });
      }

      const userRoles = dbUser.roles.map(ur => ur.role.name);
      const hasRole = userRoles.some(role => allowedRoles.includes(role));

      if (!hasRole) {
        return res.status(403).json({ error: "Acceso denegado. Rol insuficiente." });
      }

      next();
    } catch (error) {
      console.error("Error en middleware checkRoles:", error);
      return res.status(500).json({ error: "Error al verificar permisos." });
    }
  };
};