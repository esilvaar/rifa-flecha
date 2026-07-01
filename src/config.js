// src/config.js

// Cantidad total de números de la rifa (ej: 250, 300, 1000)
export const TOTAL_NUMBERS = 200;

// Cuántos números mostrar por cada tabla/página (Ideal: 100)
export const NUMBERS_PER_PAGE = 100;

// Cálculo automático de cuántas páginas/tablas se necesitan
// Si son 250 números y 100 por página = 2.5 => Math.ceil sube a 3 páginas
export const TOTAL_PAGES = Math.ceil(TOTAL_NUMBERS / NUMBERS_PER_PAGE);

export const EMAILJS_CONFIG = {
  SERVICE_ID: "service_ltjiuwc",   // Reemplaza con lo que obtuviste en Paso 1
  TEMPLATE_ID: "template_thlvsde", // Reemplaza con lo que obtuviste en Paso 1
  PUBLIC_KEY: "U85m3NrqhXQu2hPWx"    // Reemplaza con lo que obtuviste en Paso 1
};