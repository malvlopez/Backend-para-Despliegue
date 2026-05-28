import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { registerUser } from '../services/auth.service.js';
import { sendVerificationEmail } from '../services/email.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';

const prisma = new PrismaClient();

export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // 1. Validaciones previas
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    if (!email.endsWith('@epn.edu.ec')) {
      return res.status(400).json({ error: "Solo se permiten correos de la EPN" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "La contraseña es muy débil" });
    }

    // 2. Crear usuario en la base de datos (Supabase a través de Prisma)
    const user = await registerUser(req.body);
    
    // 3. INTENTO DE ENVÍO DE CORREO AISLADO (Evita el Error 502 si falla Nodemailer)
    try {
      await sendVerificationEmail(user.email, user.firstName, user.lastName, user.verificationToken);
      console.log(`Correo de verificación enviado con éxito a: ${user.email}`);
    } catch (emailError) {
      // Si falla el correo, lo registramos en logs pero NO rompemos la respuesta del servidor
      console.error("ERROR EN NODEMAILER AL ENVIAR VERIFICACIÓN:", emailError.message);
      
      return res.status(201).json({ 
        message: "Usuario creado exitosamente en la plataforma, pero hubo un problema técnico temporal al enviar el correo de verificación. Por favor, solicita un reenvío o contacta al administrador.",
        emailError: true
      });
    }

    // 4. Respuesta exitosa estándar si todo salió perfecto
    return res.status(201).json({ 
      message: "Usuario creado exitosamente. Por favor revisa tu bandeja de entrada para verificar tu cuenta." 
    });

  } catch (error) {
    // Captura fallos de base de datos o duplicados de Prisma (P2002)
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Este correo ya se encuentra registrado." });
    }
    
    console.error("ERROR CRÍTICO GLOBAL EN REGISTRO:", error);
    return res.status(500).json({ error: "Error interno del servidor. Intenta más tarde." });
  }
};

export const verifyAccount = async (req, res) => {
  const { token } = req.params;
  
  const user = await prisma.user.findFirst({ where: { verificationToken: token } });
  if (!user) return res.status(400).json({ message: "Token inválido" });

  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationToken: null }
  });

  res.json({ message: "Cuenta verificada con éxito" });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validar que vengan los campos obligatorios
    if (!email || !password) {
      return res.status(400).json({ message: "El correo y la contraseña son obligatorios" });
    }

    // 2. Buscar al usuario por su correo institucional
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // 3. Verificar si ya activó la cuenta desde el correo
    if (!user.isVerified) {
      return res.status(401).json({ message: "Debes verificar tu cuenta institucional primero" });
    }

    // 4. Comparar contraseñas usando bcrypt
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // 5. Generar el Token JWT (Le añadimos expiración por seguridad, ej. 24 horas)
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // 6. Respuesta limpia, con mensaje de éxito y datos corregidos
    res.status(200).json({
      message: "Inicio de sesión exitoso. ¡Bienvenido!",
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.log("ERROR EN LOGIN:", error);
    res.status(500).json({ message: "Error interno del servidor al intentar iniciar sesión." });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(200).json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpires
      }
    });

    await sendPasswordResetEmail(user.email, user.firstName, resetToken);

    res.status(200).json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
  } catch (error) {
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) return res.status(400).json({ message: "El token es inválido o ha expirado" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        resetToken: null
      }
    });

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        learningStyle: true,
        currentSemester: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener el perfil" });
  }
};