import { Module } from '@nestjs/common';
import { SchoolsModule } from '../schools/schools.module';
import { CashboxController } from './cashbox.controller';
import { CashboxService } from './cashbox.service';
import { FeesController } from './fees.controller';
import { FeesService } from './fees.service';

@Module({
  imports: [SchoolsModule],
  controllers: [FeesController, CashboxController],
  providers: [FeesService, CashboxService],
  exports: [FeesService, CashboxService],
})
export class FeesModule {}
