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

  const candidateModels = [
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",   // PRIORIDAD 3: Respaldo de alta calidad (Solo si fallan los anteriores)
  ];

  let lastError: any = null;
  const base64Data = base64Image.split(',')[1] || base64Image;

  // PROMPT EN ESPAÑOL (Adaptado de tu sugerencia para mayor precisión)
  const prompt = `Analiza esta imagen de un ticket de venta de Coppel. Extrae la siguiente información en formato JSON estricto:

  1. invoiceNumber: El número de factura o folio.
     - INSTRUCCIÓN: Busca "Factura No.", "Folio", "Docto".
     - REGLA: Si ves "1053" seguido de dígitos (ej. "1053 801190"), extrae SOLO la parte final única (ej. "801190").

  2. date: La fecha de la compra.
     - FORMATO DESEADO: YYYY-MM-DD (Ej: 2025-06-02).
     - NOTA: El ticket suele tener el formato "DD-MMM-YY" (Ej: "02-Jun-25"). Conviértelo tú mismo a numérico si puedes. Si no estás seguro, devuélvelo tal cual aparece.

  3. customerName: El nombre del cliente.
     - INSTRUCCIÓN: Busca explícitamente la línea que empieza con "Nombre:".
     - Extrae EL TEXTO QUE SIGUE a esa etiqueta.
     - Ejemplo: "Nombre: ALEJANDRA DE LA CRUZ" -> Extrae "ALEJANDRA DE LA CRUZ".
     - Ignora etiquetas como "No. de Cliente" o direcciones.

  4. items: Detecta TODOS los celulares vendidos en el ticket.
     - IMPORTANTE: Puede haber MÚLTIPLES celulares. Extráelos todos.
     - EXCLUYE: "CHIP", "SIM", "RECARGA", "MICA", "FUNDA" o ítems de precio <= 1.00.
     - PRECIO:
       * Toma el Precio Base.
       * Resta descuentos explícitos que veas debajo (Ej: "DESCTO P/PAQUETE", "AHORRO").
       * IGNORA descuentos de "-1.00" (son chips gratis).
       * Retorna el precio final calculado numérico.
     - MARCA (brand):
       * Busca la marca en la descripción o en la línea de abajo (Ej: "TELCEL SAMSUNG", "CEL MOTOROLA").
       * VALORES VÁLIDOS: "SAMSUNG", "APPLE", "OPPO", "ZTE", "MOTOROLA", "REALME", "VIVO", "XIAOMI", "HONOR", "HUAWEI".
       * Si no es ninguna, pon "OTRO".`;

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
                  date: { type: SchemaType.STRING },
                  customerName: { type: SchemaType.STRING },
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
            console.log(`✅ ÉXITO con Key #${keyIndex + 1} y modelo ${modelName}`, data);

            // Usamos nuestro helper robusto parseSpanishDate por si la IA falla en la conversión YYYY-MM-DD
            // Pero le damos prioridad a lo que traiga la IA si ya parece válido.
            const cleanDate = parseSpanishDate(data.date);

            // Limpieza de nombre robusta (mantenemos tu lógica anterior + la nueva instrucción en español)
            let rawName = (data.customerName || data.customer_name || data.name || '');

            // Si la IA incluyó "Nombre:" al principio, lo quitamos
            // Regex: Busca al inicio (^) variaciones de "Nombre:" con o sin espacios
            rawName = rawName.replace(/^(nombre|cliente|nom|cli)\s*[:.]?\s*/i, '');

            // Quitamos saltos de línea y espacios extra
            const cleanName = rawName.replace(/[\r\n]+/g, ' ').trim();

            return {
              invoiceNumber: data.invoiceNumber,
              price: data.price, // Puede venir undefined si no lo pedimos explícitamente en items, pero en schema está
              date: cleanDate,
              items: data.items?.map((item: any) => {
                let b = Brand.OTRO;
                const normalizedBrand = item.brand ? item.brand.toString().toUpperCase().trim() : '';

                if (Object.values(Brand).includes(normalizedBrand as Brand)) {
                  b = normalizedBrand as Brand;
                }
                return { brand: b, price: item.price };
              }),
              customerName: cleanName
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

