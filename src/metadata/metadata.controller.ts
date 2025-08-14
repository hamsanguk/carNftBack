import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { MetadataService } from './metadata.service';

@Controller('metadata')
export class MetadataController {
  constructor(private readonly svc: MetadataService) {}

  // GET /metadata?token_id=5&token_uri=ipfs://...&force=1
  @Get()
  async getOne(
    @Query('token_id') tokenId: string,
    @Query('token_uri') tokenUri?: string,
    @Query('force') force?: string,
  ) {
    const forceRefresh = force === '1' || force === 'true';
    return this.svc.getOrRefresh({ tokenId, tokenUri, forceRefresh });
  }

  // POST /metadata/refresh-batch { "token_ids": ["1","2","3"] }
  @Post('refresh-batch')
  async refreshBatch(@Body('token_ids') tokenIds: string[]) {
    return this.svc.refreshMany(tokenIds || []);
  }
}
