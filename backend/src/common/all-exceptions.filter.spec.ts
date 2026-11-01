import {
  ArgumentsHost,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

interface Body {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
}

function run(exception: unknown) {
  const json = jest.fn<void, [Body]>();
  const status = jest
    .fn<{ json: typeof json }, [number]>()
    .mockReturnValue({ json });
  const res = {
    setHeader: jest.fn(),
    status,
  };
  const req = { method: 'POST', url: '/x', header: () => undefined };
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: res.status.mock.calls[0][0],
    body: json.mock.calls[0][0],
  };
}

describe('AllExceptionsFilter', () => {
  it('keeps explicit code and fieldErrors', () => {
    const { status, body } = run(
      new BadRequestException({
        code: 'FORM_INVALID',
        message: 'Registration form data is invalid',
        fieldErrors: { role: 'role is required' },
      }),
    );
    expect(status).toBe(400);
    expect(body).toMatchObject({
      code: 'FORM_INVALID',
      message: 'Registration form data is invalid',
      fieldErrors: { role: 'role is required' },
    });
  });

  it('turns ValidationPipe message arrays into fieldErrors', () => {
    const { body } = run(
      new BadRequestException({
        message: ['email must be an email', 'phone should not be empty'],
      }),
    );
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).toBe('Some fields are invalid');
    expect(body.fieldErrors).toEqual({
      email: 'email must be an email',
      phone: 'phone should not be empty',
    });
  });

  it('derives a code from the status', () => {
    expect(run(new NotFoundException('nope')).body.code).toBe('NOT_FOUND');
  });

  it('hides unexpected errors and returns a request id', () => {
    const { status, body } = run(new Error('db password leaked'));
    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
    expect(body.message).not.toContain('db password');
    expect(body.requestId).toBeDefined();
  });
});
