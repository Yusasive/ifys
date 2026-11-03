import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
})
export class CertificatesModule {}
