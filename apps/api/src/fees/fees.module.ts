import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { CashboxController } from './cashbox.controller';
import { CashboxService } from './cashbox.service';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { OnlineController } from './online.controller';
import { OnlineService } from './online.service';
import { PayoutsController } from './payouts.controller';
import { PayoutsService } from './payouts.service';

@Module({
  imports: [SchoolsModule],
  controllers: [
    FeesController,
    CashboxController,
    OnlineController,
    PayoutsController,
  ],
  providers: [FeesService, CashboxService, OnlineService, PayoutsService],
  exports: [FeesService, CashboxService],
})
export class FeesModule {}
