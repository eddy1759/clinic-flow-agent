import { Module } from '@nestjs/common';
import { SchedulingService } from './scheduling.service';

@Module({
  providers: [SchedulingService],
})
export class SchedulingModule {}
