import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CsrfGuard } from '../auth/csrf.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CertificatesService } from './certificates.service';
import { SendTestCertificateDto } from './dto/send-test-certificate.dto';

@Controller('admin/certificates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard, CsrfGuard)
@Roles('organizer', 'super_admin')
@RequirePermissions('tags.manage')
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get()
  list(@Query('event') eventSlug: string) {
    return this.certificates.listRecipients(eventSlug);
  }

  @Post('test')
  sendTest(
    @Query('event') eventSlug: string,
    @Body() dto: SendTestCertificateDto,
  ) {
    return this.certificates.sendTest(eventSlug, dto.email, dto.name);
  }
}
