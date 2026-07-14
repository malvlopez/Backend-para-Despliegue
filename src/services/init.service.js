import { PrismaClient } from '../generated/prisma/index.js';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

export const initializeFirstAdmin = async () => {
  try {
    const adminRole = await prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Administrador global' }
    });

    const studentRole = await prisma.role.upsert({
      where: { name: 'STUDENT' },
      update: {},
      create: { name: 'STUDENT', description: 'Estudiante EPN' }
    });

    const adminEmail = process.env.FIRST_ADMIN_EMAIL || 'admin@epn.edu.ec';
    const adminPassword = process.env.FIRST_ADMIN_PASSWORD || 'SuperAdmin2026*';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        isActive: true,
        isVerified: true,
        password: hashedPassword
      },
      create: {
        name: 'Super Administrador',
        email: adminEmail,
        password: hashedPassword,
        isVerified: true,
        isActive: true,
        roles: {
          create: { roleId: adminRole.id }
        }
      }
    });

    console.log("Roles base y Super Admin garantizados en el sistema.");
  } catch (error) {
    console.error(error);
  }
};