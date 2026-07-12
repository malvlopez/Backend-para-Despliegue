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

    const adminCount = await prisma.userRole.count({
      where: { roleId: adminRole.id }
    });

    if (adminCount === 0) {
      const hashedPassword = await bcrypt.hash(process.env.FIRST_ADMIN_PASSWORD || 'SuperAdmin2026*', 10);
      
      await prisma.user.create({
        data: {
          name: 'Super Administrador',
          email: process.env.FIRST_ADMIN_EMAIL || 'admin@epn.edu.ec',
          password: hashedPassword,
          isVerified: true,
          roles: {
            create: { roleId: adminRole.id }
          }
        }
      });
      console.log("Admin inicial y roles base creados con éxito.");
    }
  } catch (error) {
    console.error(error);
  }
};