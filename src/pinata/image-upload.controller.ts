import {Controller,Post,UploadedFile,UseInterceptors,BadRequestException}from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {PinataService} from './pinata.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly pinataService: PinataService){}

@Post ('image')
@UseInterceptors(FileInterceptor('file'))
async uploadImage(@UploadedFile() file:Express.Multer.File){
    if(!file){
        throw new BadRequestException('you should upload image file')
    }
    const ipfsUri = await this.pinataService.uploadImage(file);
    return {ipfsUri};
}

}