import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://baqkkpkpoutamilwkdsl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhcWtrcGtwb3V0YW1pbHdrZHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0ODcyNjYsImV4cCI6MjA4MzA2MzI2Nn0.O4O8Sixk0M0ObG6Oi6CNyOIlM1W2NAanO0Kh1GtZVl4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Sube un archivo al bucket 'receipts' y retorna la URL pública.
 * @param file Objeto File a subir
 * @param path Ruta/Nombre del archivo
 */
export const uploadTicketImage = async (file: File): Promise<string | null> => {
  try {
    // Crear un nombre único para el archivo: timestamp-nombre
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('receipts')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('receipts')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Error en uploadTicketImage:', error);
    return null;
  }
};