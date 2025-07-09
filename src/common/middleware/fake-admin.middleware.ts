// src/common/middleware/fake-admin.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';

@Injectable()
export class FakeAdminMiddleware implements NestMiddleware {
  use(req: any, res: any, next: () => void) {
    // 모든 요청에 user 객체를 주입
    req.user = {
      role: 'admin',
      address: '0xa30c0769F261c0fB89af22d7E1F9C4d263B1d0f4', // 필요시
    };
    next();
  }
}
//이 파일은 어드민에게 허락받는 과정을 테스트하기 위한 목적으로 만들어진 파일이며 삭제되야 할 파일이야