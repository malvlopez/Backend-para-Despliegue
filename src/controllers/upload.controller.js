import prisma from '../prisma.js';
import { uploadFileToSupabase } from '../services/supabase.service.js';
import { cloudinary } from '../services/cloudinary.service.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo." });
    }

    const fileUrl = await uploadFileToSupabase(req.file);

    return res.status(200).json({
      message: "Archivo subido con éxito",
      url: fileUrl
    });
  } catch (error) {
    return res.status(500).json({ error: "Error al subir el archivo." });
  }
};

export const subirPortadaRuta = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }

  const stream = cloudinary.uploader.upload_stream(
    { folder: 'esfot-rutas' },
    (error, result) => {
      if (error) {
        return res.status(500).json({ error: 'Error al subir a Cloudinary' });
      }

      res.status(200).json({
        mensaje: 'Portada subida con éxito',
        url_imagen: result.secure_url
      });
    }
  );

  stream.end(req.file.buffer);
};

export const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se detectó ninguna imagen en la petición.' });
    }

    const userId = req.user.id; 

    const uploadPromise = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { 
          folder: 'epn_profiles',
          transformation: [{ width: 500, height: 500, crop: "fill" }] 
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profilePicture: result.secure_url }
    });

    return res.status(200).json({ 
      message: 'Foto de perfil actualizada exitosamente.',
      url: updatedUser.profilePicture 
    });

  } catch (error) {
    return res.status(500).json({ error: 'Fallo interno al procesar la imagen con Cloudinary.' });
  }
};