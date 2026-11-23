import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { LifecycleService } from './lifecycle.service';
import { OnboardingService } from './onboarding.service';
import { SchoolsController } from './schools.controller';

@Module({
  controllers: [SchoolsController],
  providers: [OnboardingService, BillingService, LifecycleService],
  exports: [OnboardingService, BillingService, LifecycleService],
})
export class SchoolsModule {}
