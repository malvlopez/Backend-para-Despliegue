import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export const prepareResourceForGemini = async (resource) => {
  try {
    if (resource.type === 'VIDEO') {
      return `\n--- Video de YouTube: ${resource.title} ---\nEnlace: ${resource.url}\n`;
    }

    if (resource.type === 'LINK') {
      const response = await axios.get(resource.url);
      const $ = cheerio.load(response.data);
      $('script, style, nav, footer, header, aside, svg, iframe, noscript, form, button').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      return `\n--- Artículo Web: ${resource.title} ---\n${text.substring(0, 50000)}\n`;
    }

    if (resource.type === 'PDF') {
      const response = await fetch(resource.url);
      const buffer = await response.arrayBuffer();
      const data = await pdfParse(Buffer.from(buffer));
      return `\n--- Documento PDF: ${resource.title} ---\n${data.text.substring(0, 150000)}\n`;
    }

    if (resource.type === 'IMAGE') {
      return `\n--- Imagen referencial: ${resource.title} ---\nEnlace: ${resource.url}\n`;
    }

    return '';
  } catch (error) {
    console.error(`Error al procesar el recurso ${resource.title}:`, error);
    return `\n[Aviso: No se pudo extraer el texto de ${resource.title}]\n`;
  }
};