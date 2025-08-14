import { Controller, Post, Get, Patch, Param, Body, Req, ParseIntPipe, BadRequestException } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post('mint')
  async mint(@Body() createVehicleDto: CreateVehicleDto, @Req() req: any) {
    console.log('try minting');
    const ownerAddress = req.headers['x-owner-address'] || '0x0000000000000000000000000000000000000000';
    const workshopAddress = req.headers['x-workshop-address'];
    if (!workshopAddress) {throw new BadRequestException('workshop address header is missing')}
    try {
      const vehicle = await this.vehiclesService.mintVehicle(createVehicleDto, ownerAddress, workshopAddress);
      return { message: 'Mint success', vehicle };
    } catch (error) {
      console.error('mint 중 에러:', error);
      throw error;
    }
  }

  @Get(':tokenId')
  async getVehicle(@Param('tokenId', ParseIntPipe) tokenId: number) {
    return this.vehiclesService.getVehicle(tokenId);
  }

  @Patch(':tokenId/mark-sale')
  async markForSale(@Param('tokenId') tokenId:number){
    return this.vehiclesService.updateSaleStatus(tokenId, true);
  }                   //매물로 내놓을지 말지 결정하는 로직
  @Patch(':tokenId/mark-sale')
  async unlist(@Param('tokenId') tokenId:number){
    return this.vehiclesService.updateSaleStatus(tokenId, false);
  }

  @Get(':tokenId/owner')
async getOwner(@Param('tokenId', ParseIntPipe) tokenId: number) {
  // 온체인에서 ownerOf 조회
  const owner = await this.vehiclesService.getOwnerOnChain(tokenId);
  return { owner };
}
  @Get()
  async getAllVehicles() {
    return this.vehiclesService.getAllVehicles();
  }
}
//db save fail: db tokenId 3, contract.totaltransfer 4
