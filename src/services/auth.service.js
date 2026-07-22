import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../prisma.js';

export const registerUser = async (userData) => {
  const { name, email, password } = userData;
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationToken = crypto.randomBytes(32).toString('hex');

  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      verificationToken,
      isVerified: false,
      roles: {
        create: {
          role: {
            connectOrCreate: {
              where: { name: 'STUDENT' },
              create: { 
                name: 'STUDENT',
                description: 'Rol básico para estudiantes de la institución' 
              }
            }
          }
        }
      }
    }
  });

  return newUser;
};