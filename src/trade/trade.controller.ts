import {
    Body, Controller, Get, Param, Patch, Post, Query, UseGuards, NotFoundException, ConflictException
  } from '@nestjs/common';
  import { TradeService } from './trade.service';
  import { CreateTradeRequestDto } from './dto/create-trade-request.dto';
  import { RolesGuard } from 'src/auth/roles.guard';
  import { Roles } from 'src/auth/roles.decorator';
  
  @Controller('trade')
  export class TradeController {
    constructor(private readonly tradeService: TradeService) {}
  
    @Post('request')
    async requestTrade(@Body() dto: CreateTradeRequestDto) {
      return this.tradeService.createTradeRequest(dto);
    }

    @Get('request')
    async getRequestByTokenAndRequester(
      @Query('token_id') tokenId:string,
      @Query('requester') requester:string
    ){
      return this.tradeService.getRequestByTokenAndRequester(tokenId,requester);
    }
  
    @Get('requests')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async getRequests(@Query('status') status: string) {
      return this.tradeService.getRequestsByStatus(status);
    }
//판매자용- 토큰의 최신 승인 요쳥
    @Get('latest-approved')
    async getLatestApproved(@Query('token_id') tokenId:string){
      return this.tradeService.getLatestApprovedRequestByToken(tokenId)
    }
  
    @Patch(':id/approve')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async approve(@Param('id') id: string) {
      return this.tradeService.approveRequest(id, true);
    }
    
    @Patch(':id/reject')
    @UseGuards(RolesGuard)
    @Roles('admin')
    async reject(@Param('id') id: string) {
      return this.tradeService.approveRequest(id, false);
    }

    @Patch(':id/complete')
    async complete(@Param('id') id:string, @Body('tx_hash') txHash: string){
      return this.tradeService.completeRequest(id, txHash)
    }

  }
  