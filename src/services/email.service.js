import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export const sendVerificationEmail = async (userEmail, firstName, lastName, token) => {
  const confirmUrl = `${process.env.FRONTEND_URL}/confirm/${token}`;
  const fullName = `${firstName} ${lastName}`;

  const mailOptions = {
    from: `"Plataforma TSDS" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: 'Verifica tu cuenta institucional ESFOT',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #1e3a8a; text-align: center;">¡Bienvenido a TSDS!</h2>
        <p style="color: #374151; font-size: 16px;">Hola <strong>${fullName}</strong>,</p>
        <p style="color: #374151; font-size: 16px;">Gracias por registrarte. Para poder acceder a tu entorno autónomo de aprendizaje, necesitamos verificar tu correo institucional.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Verificar mi cuenta</a>
        </div>
        <p style="color: #6b7280; font-size: 14px; text-align: center;">Si el botón no funciona, copia y pega el siguiente enlace:</p>
        <p style="color: #3b82f6; font-size: 12px; word-break: break-all; text-align: center;">${confirmUrl}</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (email, firstName, token) => {
  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

  const mailOptions = {
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Recuperación de Contraseña - TSDS ESFOT',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #1e3a8a; text-align: center;">Recuperación de Acceso</h2>
        <p>Hola ${firstName},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en la plataforma TSDS.</p>
        <p>Si fuiste tú, haz clic en el siguiente botón para crear una nueva contraseña. Este enlace expirará en 1 hora.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Restablecer mi contraseña</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetLink}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Si no solicitaste este cambio, ignora este correo. Tu cuenta está segura.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};