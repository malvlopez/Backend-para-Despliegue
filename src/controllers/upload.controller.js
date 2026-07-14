import { uploadFileToSupabase } from '../services/supabase.service.js';

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
    console.error(error);
    return res.status(500).json({ error: "Error al subir el archivo." });
  }
};