import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { registerUser } from '../services/auth.service.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service.js';

const prisma = new PrismaClient();

// 1. REGISTRO DE USUARIO
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    if (!email.endsWith('@epn.edu.ec')) {
      return res.status(400).json({ error: "Solo se permiten correos de la EPN" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const user = await registerUser(req.body);
    
    try {
      await sendVerificationEmail(user.email, user.verificationToken);
      console.log(`Correo de verificación enviado con éxito a: ${user.email}`);
    } catch (emailError) {
      console.error("ERROR EN NODEMAILER AL ENVIAR VERIFICACIÓN:", emailError.message);
      return res.status(201).json({ 
        message: "Usuario creado exitosamente en la plataforma, pero hubo un problema al enviar el correo de verificación. Contacta al administrador.",
        emailError: true
      });
    }

    return res.status(201).json({ 
      message: "Usuario creado exitosamente. Por favor revisa tu bandeja de entrada para verificar tu cuenta." 
    });

  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Este correo ya se encuentra registrado." });
    }
    console.error("ERROR CRÍTICO GLOBAL EN REGISTRO:", error);
    return res.status(500).json({ error: "Error interno del servidor. Intenta más tarde." });
  }
};

// 2. VERIFICACIÓN DE CUENTA
export const verifyAccount = async (req, res) => {
  try {
    const { token } = req.params;
    
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    if (!user) return res.status(400).json({ message: "Token inválido" });

    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, verificationToken: null }
    });

    res.json({ message: "Cuenta verificada con éxito" });
  } catch (error) {
    res.status(500).json({ error: "Error al verificar la cuenta." });
  }
};

// 3. INICIO DE SESIÓN (LOGIN)
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "El correo y la contraseña son obligatorios" });
    }

    // Traemos al usuario incluyendo la relación de roles intermedia y el Rol final
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: {
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user) return res.status(404).json({ message: "Usuario no encontrado" });
    if (!user.isVerified) return res.status(401).json({ message: "Debes verificar tu cuenta institucional primero" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(401).json({ message: "Contraseña incorrecta" });

    // Mapeamos las relaciones n a n a un array limpio de strings: ["STUDENT", "ADMIN"]
    const userRoles = user.roles.map(ur => ur.role.name);

    // Guardamos el array de roles en el JWT
    const token = jwt.sign(
      { id: user.id, roles: userRoles }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: "Inicio de sesión exitoso. ¡Bienvenido!",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: userRoles
      }
    });
  } catch (error) {
    console.error("ERROR EN LOGIN:", error);
    res.status(500).json({ message: "Error interno del servidor al intentar iniciar sesión." });
  }
};

// 4. SOLICITAR RECUPERACIÓN DE CONTRASEÑA
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Mitigación de enumeración de usuarios: devolvemos 200 aunque no exista
    if (!user) {
      return res.status(200).json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Si necesitas expirar el token, recuerda agregar el campo `resetTokenExpires DateTime?` a tu esquema Prisma.
    // Por ahora lo guardamos usando Prisma de manera segura (No SQL crudo)
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken }
    });

    await sendPasswordResetEmail(user.email, user.name, resetToken);

    res.status(200).json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
  } catch (error) {
    console.error("ERROR EN FORGOT PASSWORD:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

// 5. RESTABLECER CONTRASEÑA
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ message: "La nueva contraseña debe tener al menos 8 caracteres" });
    }

    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) return res.status(400).json({ message: "El token es inválido o ha expirado" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        resetToken: null // Se limpia para evitar reusos
      }
    });

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. OBTENER PERFIL DE USUARIO LOGUEADO
export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        streak: true,
        level: true,
        xp: true,
        initials: true,
        learningProfile: true,
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

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const flatUser = {
      ...user,
      roles: user.roles.map(ur => ur.role.name)
    };

    res.json(flatUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al obtener el perfil" });
  }
};