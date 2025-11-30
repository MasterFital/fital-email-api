// Email Validation Service - Validación avanzada de emails
import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

// Lista de dominios desechables conocidos
const disposableDomains = new Set([
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "mailinator.com",
  "tempail.com",
  "fakeinbox.com",
  "sharklasers.com",
  "guerrillamail.info",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "pokemail.net",
  "spam4.me",
  "discard.email",
  "discardmail.com",
  "spambog.com",
  "spambog.de",
  "spambog.ru",
  "tempr.email",
  "temp-mail.org",
  "temp-mail.io",
  "getnada.com",
  "getairmail.com",
  "mohmal.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",
  "mega.zik.dj",
  "speed.1s.fr",
  "courriel.fr.nf",
  "moncourrier.fr.nf",
  "monemail.fr.nf",
  "monmail.fr.nf",
  "mailnesia.com",
  "maildrop.cc",
  "mintemail.com",
  "trashmail.com",
  "trashmail.me",
  "trashmail.ws",
]);

// Regex RFC5322 para validación de email
const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export interface EmailValidationResult {
  email: string;
  valid: boolean;
  disposable: boolean;
  domain: string;
  mxRecords: boolean;
  score: number; // 0-100 score de confianza
  reasons: string[];
}

// Validar sintaxis del email
function validateSyntax(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }
  
  // Longitud máxima según RFC 5321
  if (email.length > 254) {
    return false;
  }
  
  // Validar con regex
  if (!emailRegex.test(email)) {
    return false;
  }
  
  // Validar partes locales y de dominio
  const parts = email.split("@");
  if (parts.length !== 2) {
    return false;
  }
  
  const [local, domain] = parts;
  
  // Local part max 64 chars
  if (local.length > 64) {
    return false;
  }
  
  // Domain validation
  if (domain.length > 255) {
    return false;
  }
  
  return true;
}

// Verificar si es dominio desechable
function isDisposableDomain(domain: string): boolean {
  const lowerDomain = domain.toLowerCase();
  return disposableDomains.has(lowerDomain);
}

// Verificar registros MX del dominio
async function checkMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await resolveMx(domain);
    return records && records.length > 0;
  } catch (error) {
    return false;
  }
}

// Validación completa de email
export async function validateEmail(email: string): Promise<EmailValidationResult> {
  const result: EmailValidationResult = {
    email,
    valid: false,
    disposable: false,
    domain: "",
    mxRecords: false,
    score: 0,
    reasons: [],
  };

  // 1. Validar sintaxis
  if (!validateSyntax(email)) {
    result.reasons.push("Sintaxis de email inválida");
    return result;
  }

  const domain = email.split("@")[1].toLowerCase();
  result.domain = domain;

  // 2. Verificar si es dominio desechable
  result.disposable = isDisposableDomain(domain);
  if (result.disposable) {
    result.reasons.push("Dominio de email desechable/temporal");
  }

  // 3. Verificar registros MX
  result.mxRecords = await checkMxRecords(domain);
  if (!result.mxRecords) {
    result.reasons.push("El dominio no tiene registros MX válidos");
  }

  // 4. Calcular score
  let score = 0;
  
  // Sintaxis correcta: +30
  score += 30;
  
  // No es desechable: +30
  if (!result.disposable) {
    score += 30;
  }
  
  // Tiene MX records: +40
  if (result.mxRecords) {
    score += 40;
  }

  result.score = score;
  result.valid = score >= 70 && result.mxRecords && !result.disposable;

  if (result.valid) {
    result.reasons = ["Email válido y verificado"];
  }

  return result;
}

// Validación rápida (solo sintaxis)
export function quickValidate(email: string): boolean {
  return validateSyntax(email);
}

// Validar múltiples emails
export async function validateEmails(emails: string[]): Promise<EmailValidationResult[]> {
  return Promise.all(emails.map(validateEmail));
}
