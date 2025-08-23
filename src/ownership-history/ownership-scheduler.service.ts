// back/src/modules/ownership-history/ownership-scheduler.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OwnershipPollingService } from './ownership-poller.service';

@Injectable()
export class OwnershipSchedulerService {
  private readonly logger = new Logger(OwnershipSchedulerService.name);

  constructor(private readonly poller: OwnershipPollingService) {}

  @Cron(CronExpression.EVERY_MINUTE, { //EVERY_30_MINUTES, EVERY_MINUTE
    name: 'ownership-indexing',
    timeZone: 'Asia/Seoul', 
  })
//수동인덱싱
  async runIndexingJob() {
    if (process.env.OWNERSHIP_INDEX_CRON_ENABLED === 'false') {//.env에서
      return;
    }
    this.logger.log('[CRON] ownership indexing start');
    await this.poller.safePoll();
    this.logger.log('[CRON] ownership indexing end');
  }
}
