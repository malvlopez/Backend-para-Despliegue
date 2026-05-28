import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const registerUser = async (userData) => {
  const { firstName, lastName, email, password } = userData;

  const hashedPassword = await bcrypt.hash(password, 10);
  const vToken = crypto.randomBytes(32).toString('hex');

  const user = await prisma.user.create({
    data: {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      verificationToken: vToken
    }
  });

  return user;
};