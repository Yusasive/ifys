import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FEEDBACK_FORM } from './feedback-form';
import { validateAnswers } from './validate-answers';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  private async findEvent(eventSlug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug: eventSlug },
    });
    if (!event) {
      throw new NotFoundException(`No event found for slug "${eventSlug}"`);
    }
    return event;
  }

  getForm() {
    return FEEDBACK_FORM;
  }

  async create(dto: CreateFeedbackDto) {
    // A bot filled the hidden field. Pretend it worked, store nothing.
    if (dto.website?.trim()) return { id: 'ok' };

    const event = await this.findEvent(dto.eventSlug);
    const { answers, testimonialConsent } = validateAnswers(
      dto.role,
      dto.answers,
      dto.consent,
    );
    // A testimonial can't be credited to nobody.
    if (testimonialConsent && !dto.name?.trim()) {
      throw new BadRequestException(
        'Please add your name so we can credit your testimonial.',
      );
    }
    const submission = await this.prisma.feedbackSubmission.create({
      data: {
        eventId: event.id,
        role: dto.role,
        name: dto.name?.trim() || null,
        email: dto.email?.trim().toLowerCase() || null,
        answersJson: answers as Prisma.InputJsonObject,
        testimonialConsent,
      },
    });
    return { id: submission.id };
  }

  // Every response for the event, newest first. Volumes are in the hundreds,
  // so the admin page summarises and exports from this one list.
  async listAdmin(eventSlug: string) {
    const event = await this.findEvent(eventSlug);
    const submissions = await this.prisma.feedbackSubmission.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      form: FEEDBACK_FORM,
      submissions: submissions.map((s) => ({
        id: s.id,
        role: s.role,
        name: s.name,
        email: s.email,
        answers: s.answersJson,
        testimonialConsent: s.testimonialConsent,
        createdAt: s.createdAt.toISOString(),
      })),
    };
  }
}
