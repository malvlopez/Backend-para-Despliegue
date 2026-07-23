import prisma from '../prisma.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { registerUser } from '../services/auth.service.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service.js';

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
    } catch (emailError) {
      console.error("Error al enviar email de verificación:", emailError);
      return res.status(201).json({ 
        message: "Usuario creado exitosamente en la plataforma, pero hubo un problema al enviar el correo de verificación.",
        verificationToken: user.verificationToken, // Token devuelto aquí también por respaldo
        emailError: true
      });
    }

    // Devuelto aquí para pruebas directas del Backend
    return res.status(201).json({ 
      message: "Usuario creado exitosamente. Por favor revisa tu bandeja de entrada o usa el token adjunto.",
      verificationToken: user.verificationToken 
    });

  } catch (error) {
    console.error("Error en register:", error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: "Este correo ya se encuentra registrado." });
    }
    return res.status(500).json({ error: "Error interno del servidor. Intenta más tarde." });
  }
};

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
    console.error("Error en verifyAccount:", error);
    res.status(500).json({ error: "Error al verificar la cuenta." });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "El correo y la contraseña son obligatorios" });
    }

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

    const userRoles = user.roles.map(ur => ur.role.name);

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
    console.error("Error en login:", error);
    res.status(500).json({ message: "Error interno del servidor al intentar iniciar sesión." });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Por seguridad, si el usuario no existe no revelamos el token
      return res.status(200).json({ message: "Si el correo está registrado, recibirás un enlace de recuperación." });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken }
    });

    try {
      await sendPasswordResetEmail(user.email, user.name, resetToken);
    } catch (emailError) {
      console.error("Error al enviar email de restablecimiento:", emailError);
    }

    // Retornamos el token directo en la respuesta HTTP para evaluación del Backend
    res.status(200).json({ 
      message: "Si el correo está registrado, recibirás un enlace de recuperación.",
      resetToken // <--- Token listo para usar en tu cliente API (Postman / Bruno)
    });
  } catch (error) {
    console.error("Error en forgotPassword:", error);
    res.status(500).json({ error: "Error interno del servidor." });
  }
};

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
        resetToken: null
      }
    });

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    console.error("Error en resetPassword:", error);
    res.status(500).json({ error: error.message });
  }
};

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
        profilePicture: true,
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
    console.error("Error en getProfile:", error);
    res.status(500).json({ error: "Error al obtener el perfil" });
  }
};

export const checkCedula = async (req, res) => {
  const { cedula } = req.params;
  const url = `https://api.ecuadorapi.com/v1/person?id=${cedula}`;

  https.get(url, (apiRes) => {
    let data = '';

    apiRes.on('data', (chunk) => {
      data += chunk;
    });

    apiRes.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        return res.status(200).json(jsonData);
      } catch (e) {
        return res.status(500).json({ error: "Error al procesar la respuesta del Registro Civil" });
      }
    });

  }).on('error', (err) => {
    return res.status(500).json({ error: "No se pudo conectar con el servicio de verificación" });
  });
};