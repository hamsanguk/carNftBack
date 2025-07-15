// src/vehicles/mint-request.controller.ts
import { Controller, Post, Body, Get, Patch, Param, Query } from '@nestjs/common';
import { MintRequestService } from './mint-request.service';

@Controller('api/vin-requests')
export class MintRequestController {
  constructor(private readonly service: MintRequestService) {}

  // 워크샵 → 민팅 요청 등록
  @Post()
  async create(@Body() body: any) {
    // {workshop, vin, manufacturer, model}
    return this.service.create(body);
  }

  // 승인 대기 리스트(admin용)
  @Get('pending')
  async getPending() {
    return this.service.findPending();
  }

  // 승인 처리(admin)s
  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    await this.service.approve(Number(id));
    return { success: true };
  }

  // 워크샵별 승인된 요청 리스트(프론트 사용)
  @Get()
  async getByStatus(
    @Query('workshop') workshop: string,
    @Query('status') status: string
  ) {
    if (status === 'approved') {
      return this.service.findByStatusAndWorkshop('approved', workshop);
    }
    if (status === 'pending') {
      return this.service.findByStatusAndWorkshop('pending', workshop);
    }
    return [];
  }
  // async getApprovedByWorkshop(
  //   @Query('workshop') workshop: string,
  //   @Query('status') status: string
  // ) {
  //   if (status === 'approved') {
  //     return this.service.findApprovedByWorkshop(workshop);
  //   }
  //   // 확장 가능: status별 분기
  //   return [];
  // }
}
