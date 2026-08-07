import {
  FormValidationError,
  validateRegistrationFormData,
} from './form-validation';

describe('validateRegistrationFormData', () => {
  describe('student', () => {
    const valid = {
      institution: 'University of Ilorin',
      studentIdFileKey: 'student-ids/abc123.jpg',
    };

    it('accepts a complete student form', () => {
      expect(() =>
        validateRegistrationFormData('student', valid),
      ).not.toThrow();
    });

    it.each(Object.keys(valid))('rejects a missing %s', (field) => {
      const rest = { ...valid } as Record<string, string>;
      delete rest[field];
      expect(() => validateRegistrationFormData('student', rest)).toThrow(
        FormValidationError,
      );
    });

    it('reports every missing field at once', () => {
      try {
        validateRegistrationFormData('student', {});
        fail('expected FormValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(FormValidationError);
        expect(
          Object.keys((err as FormValidationError).fieldErrors).sort(),
        ).toEqual(['institution', 'studentIdFileKey']);
      }
    });
  });

  describe('founder', () => {
    const valid = {
      startupName: 'Barakah Labs',
      role: 'Founder',
      industry: 'Fintech',
    };

    it('accepts a complete founder form without linkedin', () => {
      expect(() =>
        validateRegistrationFormData('founder', valid),
      ).not.toThrow();
    });

    it('accepts a valid linkedin URL', () => {
      expect(() =>
        validateRegistrationFormData('founder', {
          ...valid,
          linkedin: 'https://www.linkedin.com/in/example',
        }),
      ).not.toThrow();
    });

    it('rejects an invalid linkedin URL', () => {
      expect(() =>
        validateRegistrationFormData('founder', {
          ...valid,
          linkedin: 'not-a-url',
        }),
      ).toThrow(FormValidationError);
    });

    it.each(['startupName', 'role', 'industry'])(
      'rejects a missing %s',
      (field) => {
        const rest = { ...valid } as Record<string, string>;
        delete rest[field];
        expect(() => validateRegistrationFormData('founder', rest)).toThrow(
          FormValidationError,
        );
      },
    );
  });

  describe('professional', () => {
    const valid = {
      organization: 'Acme Bank',
      role: 'Analyst',
      industry: 'Banking',
    };

    it('accepts a complete professional form', () => {
      expect(() =>
        validateRegistrationFormData('professional', valid),
      ).not.toThrow();
    });

    it('accepts a professional form without organization', () => {
      const rest = { ...valid } as Record<string, string>;
      delete rest.organization;
      expect(() =>
        validateRegistrationFormData('professional', rest),
      ).not.toThrow();
    });

    it.each(['role', 'industry'])('rejects a missing %s', (field) => {
      const rest = { ...valid } as Record<string, string>;
      delete rest[field];
      expect(() => validateRegistrationFormData('professional', rest)).toThrow(
        FormValidationError,
      );
    });
  });

  it('rejects non-object formData', () => {
    expect(() => validateRegistrationFormData('student', null)).toThrow(
      FormValidationError,
    );
    expect(() => validateRegistrationFormData('student', 'oops')).toThrow(
      FormValidationError,
    );
    expect(() => validateRegistrationFormData('student', [])).toThrow(
      FormValidationError,
    );
  });
});
