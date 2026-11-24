import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { CashboxController } from './cashbox.controller';
import { CashboxService } from './cashbox.service';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';
import { OnlineController } from './online.controller';
import { OnlineService } from './online.service';

@Module({
  imports: [SchoolsModule],
  controllers: [FeesController, CashboxController, OnlineController],
  providers: [FeesService, CashboxService, OnlineService],
  exports: [FeesService, CashboxService],
})
export class FeesModule {}
