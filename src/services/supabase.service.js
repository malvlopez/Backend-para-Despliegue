import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const uploadFileToSupabase = async (file) => {
  const fileExtension = file.originalname.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtension}`;
  const filePath = `resources/${fileName}`;

  const { error } = await supabase.storage
    .from('esfot-resources')
    .upload(filePath, file.buffer, {
      contentType: file.mimetype
    });

  if (error) {
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('esfot-resources')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
};