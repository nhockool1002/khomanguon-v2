import { Global, Module } from '@nestjs/common';
import { RecaptchaService } from './recaptcha.service';
import { RecaptchaController } from './recaptcha.controller';
import { AuthModule } from '../auth/auth.module';

// @Global() — AuthService (module auth/) cần inject RecaptchaService để verify() lúc đăng ký/đăng
// nhập; export sẵn để không phải import RecaptchaModule vào AuthModule (tránh vòng phụ thuộc vì
// module này tự import AuthModule cho guard ở trên).
@Global()
@Module({
  imports: [AuthModule],
  controllers: [RecaptchaController],
  providers: [RecaptchaService],
  exports: [RecaptchaService],
})
export class RecaptchaModule {}
