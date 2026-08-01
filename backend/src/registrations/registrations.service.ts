import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { StudentIdUploadUrlDto } from './dto/upload-url.dto';
import {
  FormValidationError,
  validateRegistrationFormData,
} from './form-validation';

function isPrismaUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    err.code === 'P2002'
  );
}

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listTicketProducts(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
      include: {
        ticketProducts: { where: { isActive: true } },
      },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return {
      event: {
        id: event.id,
        name: event.name,
        venue: event.venue,
        startsAt: event.startsAt,
        slug: event.slug,
      },
      ticketProducts: event.ticketProducts,
    };
  }

  async createStudentIdUploadUrl(dto: StudentIdUploadUrlDto) {
    const extension = dto.fileName.split('.').pop() ?? 'bin';
    const key = `student-ids/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.getUploadUrl(key, dto.contentType);
    return { key, uploadUrl };
  }

  // No separate draft-persistence step in M1: the wizard collects state
  // client-side across steps and this is called once, at final review
  // submission, creating the registration directly as pending_payment
  // (there is no payment step yet to gate on — see milestone.md M1).
  async createRegistration(dto: CreateRegistrationDto) {
    try {
      validateRegistrationFormData(dto.category, dto.formData);
    } catch (err) {
      if (err instanceof FormValidationError) {
        throw new BadRequestException({
          message: 'Registration form data is invalid',
          fieldErrors: err.fieldErrors,
        });
      }
      throw err;
    }

    const event = await this.prisma.event.findUnique({
      where: { slug: dto.eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${dto.eventSlug}"`);
    }

    const ticketProduct = await this.prisma.ticketProduct.findUnique({
      where: {
        eventId_category_tier: {
          eventId: event.id,
          category: dto.category,
          tier: dto.tier,
        },
      },
    });
    if (!ticketProduct || !ticketProduct.isActive) {
      throw new NotFoundException(
        `No active ${dto.tier} ticket for category ${dto.category} on this event`,
      );
    }

    const attendee = await this.prisma.attendee.upsert({
      where: { email: dto.email },
      update: { fullName: dto.fullName, phone: dto.phone },
      create: { fullName: dto.fullName, email: dto.email, phone: dto.phone },
    });

    const studentIdFileUrl =
      dto.category === 'student'
        ? (dto.formData.studentIdFileKey as string)
        : null;

    try {
      return await this.prisma.registration.create({
        data: {
          eventId: event.id,
          attendeeId: attendee.id,
          ticketProductId: ticketProduct.id,
          formDataJson: dto.formData as Prisma.InputJsonValue,
          studentIdFileUrl,
          status: 'pending_payment',
        },
        include: { ticketProduct: true, attendee: true },
      });
    } catch (err: unknown) {
      if (isPrismaUniqueConstraintError(err)) {
        throw new ConflictException(
          'This email has already registered for this event.',
        );
      }
      throw err;
    }
  }

  async findById(id: string) {
    const registration = await this.prisma.registration.findUnique({
      where: { id },
      include: { ticketProduct: true, attendee: true },
    });
    if (!registration) {
      throw new NotFoundException('Registration not found');
    }
    return registration;
  }
}
