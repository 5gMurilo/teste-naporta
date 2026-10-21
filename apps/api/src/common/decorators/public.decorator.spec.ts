import { Reflector } from '@nestjs/core';
import { AppController } from '../../app.controller.js';
import { AuthController } from '../../auth/auth.controller.js';
import { HealthController } from '../../health/health.controller.js';
import { IS_PUBLIC_KEY, Public } from './public.decorator.js';

const reflector = new Reflector();

class Sample {
  @Public()
  open() {}

  closed() {}
}

@Public()
class OpenSample {
  anything() {}
}

describe('@Public', () => {
  it('marks only the decorated method', () => {
    expect(reflector.get(IS_PUBLIC_KEY, Sample.prototype.open)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, Sample.prototype.closed)).toBeUndefined();
    expect(reflector.get(IS_PUBLIC_KEY, Sample)).toBeUndefined();
  });

  it('marks a whole class without touching other classes', () => {
    expect(reflector.get(IS_PUBLIC_KEY, OpenSample)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, Sample)).toBeUndefined();
  });

  it('is applied to the login and health controllers and to nothing else', () => {
    expect(reflector.get(IS_PUBLIC_KEY, AuthController)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, HealthController)).toBe(true);
    expect(reflector.get(IS_PUBLIC_KEY, AppController)).toBeUndefined();
    expect(reflector.get(IS_PUBLIC_KEY, AppController.prototype.getHello)).toBeUndefined();
  });
});
