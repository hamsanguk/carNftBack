import { IsString } from 'class-validator';

export class CreateVehicleDto {
    @IsString()
    vin: string;

    @IsString()
    manufacturer: string;
}