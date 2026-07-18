import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const extractTextFromPDF = async (pdfUrl) => {
  try {
    const response = await fetch(pdfUrl);
    const buffer = await response.arrayBuffer();
    const data = await pdfParse(Buffer.from(buffer));
    return data.text;
  } catch (error) {
    console.error("Error al procesar el PDF:", error);
    return "";
  }
};