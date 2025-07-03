import {
    Controller, Post, Body,
    UploadedFile, UseInterceptors, Req, BadRequestException
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { PinataService } from './pinata.service';
  import {
    IsString, IsOptional, IsUrl,
    ValidateNested, IsArray
  } from 'class-validator';
  import { Transform, Type, plainToInstance } from 'class-transformer';
  
  class AttributeDto {
    @IsString()
    trait_type: string;
  
    @IsString()
    value: string | number;
  }
  
  class CreateMetadataDto {
    @IsString()
    name: string;
  
    @IsString()
    description: string;
  
    @Transform(({ value }) => value === '' ? undefined : value, { toClassOnly: true })
    @IsOptional()
    @IsUrl()
    external_url?: string;
  
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AttributeDto)
    attributes: AttributeDto[];
  }
  
  @Controller('nft/metadata')
  export class MetadataController {
    constructor(private readonly pinataService: PinataService) {}
  
    @Post()
    @UseInterceptors(FileInterceptor('image'))
    async createMetadata(
      @Req() req: Request,
      @UploadedFile() image: Express.Multer.File,
      @Body() body: any,              // 일단 any로 받고
    ) {
      // 1) multipart/form-data 로 넘어온 attributes 필드가 문자열이면 파싱
      if (typeof body.attributes === 'string') {
        try {
          body.attributes = JSON.parse(body.attributes);
        } catch {
          throw new BadRequestException('Invalid JSON in attributes');
        }
      }
  
      // 2) 파싱된 body를 DTO로 변환 & 검증
      const dto = plainToInstance(CreateMetadataDto, body, { enableImplicitConversion: true });
      // (글로벌 ValidationPipe가 있다면 아래 줄 대신 생략 가능)
      // await validateOrReject(dto, { whitelist: true });
  
      console.log('DTO:', dto);
      console.log('raw body:', body);
  
      // 이하 업로드 로직…
      let imageUri: string | undefined;
      if (image) {
        imageUri = await this.pinataService.uploadImage(image);
      }
  
      const metadata: Record<string, any> = {
        name: dto.name,
        description: dto.description,
        ...(dto.external_url ? { external_url: dto.external_url } : {}),
        attributes: dto.attributes,
        ...(imageUri ? { image: imageUri } : {}),
      };
  
      const metadataUri = await this.pinataService.uploadMetadata(metadata);
      return { metadataUri };
    }
  }
  