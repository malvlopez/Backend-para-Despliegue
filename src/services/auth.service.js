import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const registerUser = async (userData) => {
  const { name, email, password } = userData;

  const hashedPassword = await bcrypt.hash(password, 10);
  const vToken = crypto.randomBytes(32).toString('hex');

  const user = await prisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      verificationToken: vToken,
      // Asignamos el rol por defecto
      roles: {
        create: {
          role: {
            connect: { name: "STUDENT" }
          }
        }
      }
    }
  });

  return user;
};