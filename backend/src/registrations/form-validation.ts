import { Category } from '../generated/prisma/enums';

export class FormValidationError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>) {
    super('Registration form data is invalid');
  }
}

const LINKEDIN_URL_PATTERN = /^https?:\/\/(www\.)?linkedin\.com\/.+/i;

function requireString(
  formData: Record<string, unknown>,
  field: string,
  errors: Record<string, string>,
): void {
  const value = formData[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors[field] = `${field} is required`;
  }
}

function checkOptionalLinkedin(
  formData: Record<string, unknown>,
  errors: Record<string, string>,
): void {
  const value = formData.linkedin;
  if (value === undefined || value === null || value === '') return;
  if (typeof value !== 'string' || !LINKEDIN_URL_PATTERN.test(value)) {
    errors.linkedin = 'linkedin must be a valid linkedin.com profile URL';
  }
}

export function validateRegistrationFormData(
  category: Category,
  formData: unknown,
): void {
  if (
    typeof formData !== 'object' ||
    formData === null ||
    Array.isArray(formData)
  ) {
    throw new FormValidationError({ formData: 'formData must be an object' });
  }

  const data = formData as Record<string, unknown>;
  const errors: Record<string, string> = {};

  switch (category) {
    case 'student':
      requireString(data, 'institution', errors);
      requireString(data, 'studentIdFileKey', errors);
      break;
    case 'founder':
      requireString(data, 'startupName', errors);
      requireString(data, 'role', errors);
      requireString(data, 'industry', errors);
      checkOptionalLinkedin(data, errors);
      break;
    case 'regular':
    case 'professional':
      requireString(data, 'role', errors);
      requireString(data, 'industry', errors);
      checkOptionalLinkedin(data, errors);
      break;
  }

  if (Object.keys(errors).length > 0) {
    throw new FormValidationError(errors);
  }
}
