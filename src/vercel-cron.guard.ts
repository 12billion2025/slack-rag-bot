import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VercelCronGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    const cronSecret = this.configService.get<string>('CRON_SECRET');

    if (!cronSecret) {
      throw new UnauthorizedException('CRON_SECRET이 설정되지 않았습니다');
    }

    const expectedAuth = `Bearer ${cronSecret}`;

    if (authHeader !== expectedAuth) {
      throw new UnauthorizedException('유효하지 않은 Cron 요청입니다');
    }

    return true;
  }
}
