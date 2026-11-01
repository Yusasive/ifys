import { Category } from '../generated/prisma/enums';

export function formString(data: unknown, key: string): string | null {
  if (!data || typeof data !== 'object') return null;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// The two small lines printed under a registrant's name on their sticker.
// Shared with the check-in screen so what door staff see is what the tag says.
export function registrantTagLines(category: Category, formData: unknown) {
  return {
    title:
      category === 'student'
        ? formString(formData, 'institution')
        : formString(formData, 'role'),
    organization:
      category === 'student'
        ? null
        : category === 'founder'
          ? formString(formData, 'startupName')
          : formString(formData, 'organization'),
  };
}
