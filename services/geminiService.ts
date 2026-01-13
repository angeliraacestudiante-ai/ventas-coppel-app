import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";

// --- CONFIGURACIÓN ---
const API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY_1,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
  import.meta.env.VITE_GEMINI_API_KEY,
].filter(Boolean) as string[];

const parseSpanishDate = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;
  // Intento 1: Ya está en formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Intento 2: Formato DD-MMM-YY o DD-MMM-YYYY (común en tickets)
  // Mapeo de meses español a número
  const monthMap: { [key: string]: string } = {
    'ene': '01', 'feb': '02', 'mar': '03', 'abr': '04', 'may': '05', 'jun': '06',
    'jul': '07', 'ago': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dic': '12',
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04', 'mayo': '05', 'junio': '06',
    'julio': '07', 'agosto': '08', 'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };

  try {
    // Buscar patrones: 02-Jun-25, 02/Jun/25, 02 Jun 2025
    const parts = dateStr.match(/(\d{1,2})[-/ ]([a-zA-Z]{3,})[-/ ](\d{2,4})/);
    if (parts) {
      const day = parts[1].padStart(2, '0');
      const monthStr = parts[2].toLowerCase().substring(0, 3);
      const yearRaw = parts[3];
      const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;

      const month = monthMap[monthStr];
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
  } catch (e) {
    console.warn("Error parsing date:", dateStr, e);
  }
  return undefined; // Fallback
};

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult | null> => {
  const apiKeys = API_KEYS;

  if (apiKeys.length === 0) {
    console.error("❌ No se encontraron claves API de Gemini.");
    throw new Error("Faltan las API Keys de Gemini.");
  }

  // Configuramos modelos
  const candidateModels = [
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash",
  ];

  const base64Data = base64Image.split(',')[1] || base64Image;

  // PROMPT SIN SCHEMA STRICT (Permite más flexibilidad para encontrar textos difíciles)
  const prompt = `Analiza esta imagen de ticket. Tu misión es extraer datos aunque la imagen sea borrosa.
  Responde ÚNICAMENTE con un objeto JSON válido. No uses Markdown (\`\`\`json).

  Estructura deseada:
  {
    "invoiceNumber": "Folio o Ticket",
    "date": "Fecha encontrada (ej: 12-Dic-2024)",
    "customerName": "Nombre del cliente detectado",
    "items": [{ "brand": "Marca", "price": 0 }]
  }

  Instrucciones de Extracción:
  1. invoiceNumber: Busca "Folio", "Doc", "Ticket". Si ves "1053" seguido de espacio y números, los números son el folio.
  2. date: Busca "Fecha:" o patrones de fecha (DD-MMM-YY). Devuelve lo que encuentres TEXTUALMENTE.
  3. customerName: Busca "Cliente:", "Nombre:" o "Receptor:". Si ves un nombre propio en mayúsculas (ej: "JUAN PEREZ") cerca de la cabecera, úsalo. NO uses "Coppel".
  4. items: Lista de celulares.
     - brand: MARCA (SAMSUNG, APPLE, MOTOROLA, XIAOMI, OPPO, HONOR, HUAWEI).
     - price: Precio numérico.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg",
    },
  };

  // Rotación de Claves API
  for (const [keyIndex, currentApiKey] of apiKeys.entries()) {
    console.log(`🔄 Intentando con API Key #${keyIndex + 1}...`);
    const genAI = new GoogleGenerativeAI(currentApiKey);

    for (const modelName of candidateModels) {
      try {
        console.log(`  ➡️ Modelo: ${modelName}`);
        // USAMOS EL MODELO SIN SCHEMA CONFIG (Modo Libre)
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        if (text) {
          // SANITIZACIÓN: Quitar ```json y ``` sila IA los pone
          let cleanText = text;
          const firstBrace = cleanText.indexOf('{');
          const lastBrace = cleanText.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
          }

          const data = JSON.parse(cleanText);
          console.log(`✅ ÉXITO con Key #${keyIndex + 1}`, data);

          // LIMPIEZA DE DATOS (Date & Name Cleaners)
          const cleanDate = parseSpanishDate(data.date);

          let cleanName = (data.customerName || '').trim();
          // Limpieza Extra: Quitar "Nombre:" si la IA lo incluyó
          cleanName = cleanName.replace(/^(nombre|cliente|nom|cli)\s*[:.]?\s*/i, '');

          return {
            invoiceNumber: data.invoiceNumber,
            price: 0, // No usamos precio global
            date: cleanDate,
            customerName: cleanName,
            items: data.items?.map((item: any) => {
              let b = Brand.OTRO;
              const normalizedBrand = item.brand ? item.brand.toString().toUpperCase().trim() : '';
              if (Object.values(Brand).includes(normalizedBrand as Brand)) {
                b = normalizedBrand as Brand;
              }
              return { brand: b, price: item.price };
            })
          };
        }
      } catch (error: any) {
        console.error("Error en intento Gemini:", error);
      }
    }
  }

  return null;
};

