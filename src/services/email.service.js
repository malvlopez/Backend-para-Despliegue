import dotenv from 'dotenv';
dotenv.config();

export const sendBrevoEmail = async (to, name, subject, htmlContent) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!apiKey) {
    throw new Error("Key not found");
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: 'ESFOT' },
      to: [{ email: to, name: name || 'Usuario' }],
      subject: subject,
      htmlContent: htmlContent
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(JSON.stringify(errorData));
  }
  
  return response.json();
};

export const sendVerificationEmail = async (email, token) => {
  try {
    const verificationLink = `${process.env.FRONTEND_URL}/confirm/${token}`;
    const subject = "Verifica tu cuenta institucional ESFOT";
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">Bienvenido a ESFOT</h2>
        <p style="color: #333; font-size: 16px;">Para continuar con tu registro y activar tu cuenta, por favor haz clic en el siguiente enlace:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verificar mi cuenta</a>
        </div>
        <p style="color: #777; font-size: 12px; text-align: center;">Si no solicitaste este registro, puedes ignorar este correo.</p>
      </div>
    `;

    await sendBrevoEmail(email, 'Estudiante', subject, html);
  } catch (error) {
    console.error("ERROR AL ENVIAR VERIFICACIÓN:", error.message);
    throw error;
  }
};

export const sendPasswordResetEmail = async (email, name, token) => {
  try {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <h2 style="color: #1e3a8a; text-align: center;">Recuperación de Acceso</h2>
        <p>Hola ${name},</p>
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en la plataforma TSDS.</p>
        <p>Si fuiste tú, haz clic en el siguiente botón para crear una nueva contraseña. Este enlace expirará en 1 hora.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Restablecer mi contraseña</a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <p style="color: #2563eb; font-size: 14px; word-break: break-all;">${resetLink}</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Si no solicitaste este cambio, ignora este correo. Tu cuenta está segura.</p>
      </div>
    `;

    await sendBrevoEmail(email, name, 'Recuperación de Contraseña - TSDS ESFOT', html);
  } catch (error) {
    console.error("ERROR AL ENVIAR RECUPERACIÓN:", error.message);
    throw error;
  }
};