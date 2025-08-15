import { franc } from 'franc';
import iso from 'iso-639-1';
export function detectLanguage(text: string): string {
  try {
    const lang3 = franc(text || '', { minLength: 20 }) || 'und';
    const lang2 = iso.getCode(iso.getName(lang3) || '') || (lang3.length === 2 ? lang3 : 'en');
    return lang2 || 'en';
  } catch {
    return 'en';
  }
}
export function normalizeLang(code?: string) { return iso.validate(code||'') ? (code as string) : 'en'; }
