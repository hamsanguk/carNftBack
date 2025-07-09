import { Controller, Post, Get, Param, Body, Req, ParseIntPipe } from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post('mint')
  async mint(@Body() createVehicleDto: CreateVehicleDto, @Req() req: any) {
    console.log('mint API 호출');
    const ownerAddress = req.headers['x-owner-address'] || '0x0000000000000000000000000000000000000000';
    try {
      const vehicle = await this.vehiclesService.mintVehicle(createVehicleDto, ownerAddress);
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
