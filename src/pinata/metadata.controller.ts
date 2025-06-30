// import { Controller, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
// import { FileInterceptor } from '@nestjs/platform-express';
// import { PinataService } from './pinata.service';
// import { IsString, IsOptional, IsUrl, ValidateNested, IsArray } from 'class-validator';
// import { Transform,Type } from 'class-transformer';

// class AttributeDto {
//   @IsString()
//   trait_type: string;

//   @IsString()
//   value: string | number;
// }

// class CreateMetadataDto {
  

//     @IsString()
//     name: string;
  
//     @IsString()
//     description: string;
  
//     @IsUrl()
//     @IsOptional()
//     external_url?: string;
  
//     @IsArray()
//     @Transform(({ value }) => {
//       try {
//         return JSON.parse(value);
//       } catch {
//         return [];
//       }
//     }, { toClassOnly: true })
//     @ValidateNested({ each: true })
//     @Type(() => AttributeDto)
//     attributes: AttributeDto[];
   
//   }
  

// @Controller('nft/metadata')
// export class MetadataController {
//   constructor(private readonly pinataService: PinataService) {}

//   /**
//    * 메타데이터 및 이미지(선택) 업로드
//    * POST /nft/metadata
//    * Content-Type: multipart/form-data
//    * - image: file (optional)
//    * - body fields: name, description, external_url, attributes(JSON array)
//    */
//   @Post()
//   @UseInterceptors(FileInterceptor('image'))
//   async createMetadata(
//     @UploadedFile() image: Express.Multer.File,
//     @Body() dto: CreateMetadataDto
//   ) {
//     // 이미지 IPFS 업로드 (선택)
//     let imageUri: string | undefined;
//     console.log('dto received:', dto)
//     console.log('parsed attribute:',dto.attributes)
//     if (image) {
//       imageUri = await this.pinataService.uploadImage(image);
//     }

//     // 메타데이터 객체 구성
//     const metadata: Record<string, any> = {
//       name: dto.name,
//       description: dto.description,
//       external_url: dto.external_url,
//       attributes: dto.attributes,
//     };
//     if (imageUri) {
//       metadata.image = imageUri;
//     }

//     // 메타데이터 IPFS 업로드
//     const metadataUri = await this.pinataService.uploadMetadata(metadata);
//     return { metadataUri };
//   }

// }
import {
    Controller, Post, Body,
    UploadedFile, UseInterceptors
  } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { PinataService } from './pinata.service';
  import {
    IsString, IsOptional, IsUrl,
    ValidateNested, IsArray
  } from 'class-validator';
  import { Transform, Type } from 'class-transformer';
  
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
  
    // 빈 문자열("")을 undefined로 바꾸고, undefined일 때만 URL 검증을 건너뜁니다
    @Transform(({ value }) => value === '' ? undefined : value, { toClassOnly: true })
    @IsOptional()
    @IsUrl()
    external_url?: string;
  
    @IsArray()
    // form-data의 문자열을 JSON.parse 해서 배열로 변환
    @Transform(({ value }) => {
      try { return JSON.parse(value); }
      catch { return []; }
    }, { toClassOnly: true })
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
      @UploadedFile() image: Express.Multer.File,
      @Body() dto: CreateMetadataDto
    ) {
      // 이 로그가 찍히면, ValidationPipe를 통과했다는 뜻입니다
      console.log('DTO:', dto);
  
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
  