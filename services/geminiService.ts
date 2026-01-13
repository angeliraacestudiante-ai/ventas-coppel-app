import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { TicketAnalysisResult, Brand } from "../types";
import { analyzeTicketWithGroq } from "./groqService";

// Helper to parse Coppel dates (DD-MMM-YY) like "02-Jun-25" to YYYY-MM-DD
const parseSpanishDate = (dateStr: string | undefined): string | undefined => {
  if (!dateStr) return undefined;

  // If already YYYY-MM-DD, return it
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  try {
    // Try to handle "02-Jun-25" or "02-JUN-25"
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const monthStr = parts[1].toLowerCase().substring(0, 3);
      let year = parts[2];

      // Handle year 25 -> 2025
      if (year.length === 2) year = '20' + year;

      const months: { [key: string]: string } = {
        'ene': '01', 'jan': '01',
        'feb': '02',
        'mar': '03',
        'abr': '04', 'apr': '04',
        'may': '05',
        'jun': '06',
        'jul': '07',
        'ago': '08', 'aug': '08',
        'sep': '09',
        'oct': '10',
        'nov': '11',
        'dic': '12', 'dec': '12'
      };

      const month = months[monthStr];
      if (month && day && year) {
        return `${year}-${month}-${day}`;
      }
    }
  } catch (e) {
    console.warn("Date parse error", e);
  }
  return dateStr; // Fallback to original if parse fails
};

export const analyzeTicketImage = async (base64Image: string): Promise<TicketAnalysisResult> => {
  // 1. Obtener todas las claves disponibles
  const apiKeys: string[] = [];

  // Agregar clave principal
  const mainKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (mainKey) apiKeys.push(mainKey);



  // NOTA: Se ha deshabilitado la rotación de claves adicionales a petición del usuario.
  // Solo se usará la clave principal.

  if (apiKeys.length === 0) {
    console.warn("⚠️ ADVERTENCIA: No se encontró API Key de Gemini. Se intentará usar el respaldo (Groq).");
    // No lanzamos error aquí para permitir que intente con Groq
  } else {
    console.log(`[DEBUG] Se encontraron ${apiKeys.length} claves API de Gemini.`);
  }

  // Configuramos modelos: Flash 1.5 es el más estable para texto impreso estándar.
  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
  ];

  let lastError: any = null;
  const base64Data = base64Image.split(',')[1] || base64Image;

  // ESTRATEGIA: "EXTRACCIÓN CRUDA"
  // Pedimos a la IA que nos dé el texto tal cual lo ve, sin intentar convertirlo (que es donde falla).
  // Nosotros lo procesamos con código (Regex) que es más predecible.
  const prompt = `Analiza este ticket de Coppel. Extrae los DATOS CRUDOS (Raw Data) tal como aparecen en el papel.

  1. invoiceNumber: El texto que sigue a "Factura No.", "Folio" o "Ticket". (Ej: "1053 753779" o "1053-753779").
  2. rawDate: Busca la palabra "Fecha:" y extrae todo el texto que esté PREVIAMENTE o DESPUÉS en esa zona. (Ej: "01-Jun-25" o "Fecha: 01-Jun-25").
  3. rawCustomerName: Busca la línea que contiene "Nombre:" y devuelve LA LÍNEA COMPLETA. (Ej: "Nombre: ALEJANDRA DE LA CRUZ FAJARDO").
  
  4. items: Lista de celulares.
     - Detecta la marca (SAMSUNG, APPLE, MOTOROLA, OPPO, ZTE, XIAOMI, ETC).
     - Detecta el precio base.
     - Si hay descuentos abajo, réstalos.
     - Devuelve items con { brand, price }.`;

  const imagePart = {
    inlineData: {
      data: base64Data,
      mimeType: "image/jpeg",
    },
  };

  // 2. Rotación de Claves API
  const attemptLogs: string[] = [];

  for (const [keyIndex, currentApiKey] of apiKeys.entries()) {
    console.log(`🔄 Intentando con API Key #${keyIndex + 1}...`);
    const genAI = new GoogleGenerativeAI(currentApiKey);
    let keyFailed = false;

    // Intentar con cada modelo usando la clave actual
    for (const modelName of candidateModels) {
      if (keyFailed) break; // Si la llave falló con error crítico, saltar modelos

      const MAX_RETRIES = 2; // Reducido de 5 a 2 para velocidad
      const BASE_WAIT_SECONDS = 2; // Reducido de 10s a 2s para no hacer esperar al usuario

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          console.log(`  ➡️ Modelo: ${modelName} (Intento ${attempt + 1}/${MAX_RETRIES})`);
          const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: SchemaType.OBJECT,
                properties: {
                  invoiceNumber: { type: SchemaType.STRING },
                  rawDate: { type: SchemaType.STRING },         // Solicitamos texto crudo
                  rawCustomerName: { type: SchemaType.STRING }, // Solicitamos texto crudo
                  items: {
                    type: SchemaType.ARRAY,
                    items: {
                      type: SchemaType.OBJECT,
                      properties: {
                        brand: { type: SchemaType.STRING },
                        price: { type: SchemaType.NUMBER }
                      }
                    }
                  }
                }
              }
            }
          });

          const result = await model.generateContent([prompt, imagePart]);
          const response = await result.response;
          const text = response.text();

          if (text) {
            const data = JSON.parse(text);
            console.log(`✅ ÉXITO RAW con Key #${keyIndex + 1}`, data);

            // A) PROCESAMIENTO ROBUSTO DE FECHA (Desde rawDate)
            // Buscamos patrones como "01-Jun-25" o "01/06/2025" dentro del texto sucio
            let finalDate = undefined;
            if (data.rawDate) {
              // Regex para DD-MMM-YY (ej: 01-Jun-25)
              const complexDateMatch = data.rawDate.match(/(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})/);
              if (complexDateMatch) {
                finalDate = parseSpanishDate(complexDateMatch[0]); // Usamos el helper con el match limpio
              } else {
                // Regex para DD/MM/YYYY
                const simpleDateMatch = data.rawDate.match(/(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{2,4})/);
                if (simpleDateMatch) {
                  // Reconstruir a YYYY-MM-DD
                  let [_, d, m, y] = simpleDateMatch;
                  if (y.length === 2) y = '20' + y;
                  finalDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
            }

            // B) PROCESAMIENTO ROBUSTO DE NOMBRE (Desde rawCustomerName)
            // Quitamos "Nombre:", puntaución, saltos de línea
            let finalName = '';
            if (data.rawCustomerName) {
              finalName = data.rawCustomerName
                .replace(/[\r\n]+/g, ' ')
                .replace(/^.*nombre\s*[:.]?\s*/i, '') // Borra todo hasta "Nombre:"
                .replace(/\s*No\.\s*de\s*Cliente.*$/i, '') // Borra si se coló "No. de Cliente"
                .trim();
            }

            return {
              invoiceNumber: data.invoiceNumber,
              price: 0, // No usamos el total global
              date: finalDate, // Ahora sí es YYYY-MM-DD o undefined
              items: data.items?.map((item: any) => {
                let b = Brand.OTRO;
                const normalizedBrand = item.brand ? item.brand.toString().toUpperCase().trim() : '';
                if (Object.values(Brand).includes(normalizedBrand as Brand)) {
                  b = normalizedBrand as Brand;
                }
                return { brand: b, price: item.price };
              }),
              customerName: finalName
            };
          }
          // Si llegamos aquí con éxito, salimos del bucle de intentos (return arriba ya lo hizo)

        } catch (error: any) {
          const msg = (error.message || "Unknown error").toString();

          // Lógica de Reintento para 429 (Too Many Requests) o ResourceExhausted
          if (msg.includes("429") || msg.includes("ResourceExhausted") || msg.includes("quota")) {
            console.warn(`  ⚠️ Cuota excedida (429) en ${modelName} con Key #${keyIndex + 1}.`);

            if (attempt < MAX_RETRIES - 1) {
              // Backoff Exponencial
              const waitTime = BASE_WAIT_SECONDS * (Math.pow(2, attempt)) * 1000; // 10s, 20s, 40s...
              console.log(`  ⏳ Esperando ${waitTime / 1000}s antes de reintentar...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue; // Reintentar mismo modelo, misma key
            } else {
              console.error("  ❌ Se acabaron los intentos para esta configuración.");
              attemptLogs.push(`Key #${keyIndex + 1} [${modelName}]: ⏳ Agotado tras ${MAX_RETRIES} reintentos (429)`);

              // Importante: Si falla un modelo con 429, INTENTAR EL SIGUIENTE MODELO de la lista.
              // No marcamos keyFailed = true todavía, a menos que ya estemos en el modelo más básico.

              // Si falla el "flash" estándar, es probable que la cuota global esté muerta.
              if (modelName === "gemini-1.5-flash") {
                console.error("  ❌ Falló el modelo base (Flash). Probablemente cuota agotada globalmente.");
                keyFailed = true;
              } else {
                console.warn("  ⚠️ Falló este modelo. Intentando con el siguiente de la lista...");
              }

              break; // Salir del bucle de intentos y pasar al siguiente modelo 
            }
          }

          console.warn(`  ⚠️ Falló ${modelName} con Key #${keyIndex + 1}:`, error.message);
          lastError = error;

          // Si es API Key inválida
          if (msg.includes("API key")) {
            attemptLogs.push(`Key #${keyIndex + 1}: ❌ Key Inválida`);
            keyFailed = true;
            break; // Salir del bucle de intentos y cambiar llave
          }

          // Otros errores (ej. modelo no encontrado o error interno de Google)
          // No hacemos retries, probamos el siguiente modelo
          if (modelName === candidateModels[candidateModels.length - 1] && attempt === MAX_RETRIES - 1) {
            attemptLogs.push(`Key #${keyIndex + 1}: ⚠️ Error técnico (${msg.slice(0, 20)}...)`);
          }

          // Si es un error distinto a 429, salimos del retry loop y dejamos que el loop de modelos continúe
          break;
        }
      }
    }
  }

  // --- FALLBACK: INTENTAR CON GROQ (Llama 3.2 Vision) --
  console.warn("⚠️ Todos los intentos de Gemini fallaron. Activando protocolo de respaldo (GROQ)...");

  try {
    const groqResult = await analyzeTicketWithGroq(base64Image);
    if (groqResult) {
      console.log("🏆 RESCATADO POR GROQ!");
      return groqResult;
    }
  } catch (groqError: any) {
    console.error("❌ Falló también el respaldo de Groq:", groqError.message);
    attemptLogs.push(`GROQ Backup: ❌ Error (${groqError.message})`);
  }

  // Si llegamos aquí, fallaron todas (Gemini + Groq)
  console.error("❌ Muerte total del sistema de IA.", lastError);

  // Mostrar reporte detallado al usuario
  throw new Error(`FALLO TOTAL (Gemini + Groq):\n\nPosible causa: Faltan las llaves API (API KEYS) en la configuración del servidor.\n\nSi la app está en línea, revisa las "Environment Variables" en Vercel/Netlify.\n\nDetalles técnicos:\n${attemptLogs.join('\n')}`);
};

