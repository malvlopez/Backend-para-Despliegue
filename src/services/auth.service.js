// Dentro de tu archivo: ../services/auth.service.js

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
            // Cambiamos 'connect' por 'connectOrCreate' para blindar el registro
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