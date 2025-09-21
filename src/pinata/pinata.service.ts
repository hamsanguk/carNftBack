import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataSDK from '@pinata/sdk';
import { Readable } from 'stream';

@Injectable()
export class PinataService {
  private readonly pinata;
  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('PINATA_API_KEY');
    const secret = this.config.get<string>('PINATA_API_SECRET');
    this.pinata = new PinataSDK(key, secret);
  }
  /**
   * 이미지 파일을 IPFS에 업로드하고 CID URL을 반환
   */
  async uploadImage(file: Express.Multer.File): Promise<string> {
    try { 
      const stream = Readable.from(file.buffer);
      const result = await this.pinata.pinFileToIPFS(stream, {
        pinataMetadata: { name: file.originalname }
      });
      return `ipfs://${result.IpfsHash}`;
    } catch (error) {
      console.log('pinata upload중 오류',error)
      throw new InternalServerErrorException('이미지 업로드 실패');
    }
  }

// PinataService.ts
async uploadMetadata(metadata: any): Promise<string> {
  // DTO 인스턴스 방지: Plain Object로 강제
  const json = JSON.parse(JSON.stringify(metadata)); 

  if(typeof json.image === 'string'){
    const v = json.image.trim();
    const isHttp = v.startsWith('http://') || v.startsWith('https://');
    const isIpfs = v.startsWith('ipfs://');
    const looksLikeCid = /^((Qm)[1-9A-Za-z]{44}|(bafy)[1-9A-Za-z]+)$/i.test(v);

    if (isHttp || isIpfs){
      json.image = v;
    }else if (looksLikeCid){
      json.image = `ipfs://${v}`;
    }
    // 그 외의 경우(상대경로 등)는 보장하지 않는다, 클라이언트에서 올바르게 보낸다는 가정으로
  }

  const result = await this.pinata.pinJSONToIPFS(json, {
    pinataMetadata: { name: json?.name || 'vehicle-metadata'},
  });
  return `ipfs://${result.IpfsHash}`;
}

  
}
