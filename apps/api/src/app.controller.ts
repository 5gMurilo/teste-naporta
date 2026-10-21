import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

// Legacy unversioned route kept for compatibility; it is not part of the public API contract.
@ApiExcludeController()
@Controller()
export class AppController {
  @Get()
  getHello() {
    return 'Hello World!';
  }
}
