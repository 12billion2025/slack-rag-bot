import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConversationsModule } from './conversations/conversations.module';
import { NotionModule } from './notion/notion.module';
import { ScheduleModule } from '@nestjs/schedule'; // notion을 위한 스케줄러 모듈
import { GithubModule } from './github/github.module';
import { ModelModule } from '../model/model.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SlackModule } from '../slack/slack.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL');
        return { store: await redisStore({ url: redisUrl }) };
      },
    }),
    ScheduleModule.forRoot(), // notion을 위한 스케줄러 모듈
    PrismaModule,
    ConversationsModule,
    NotionModule,
    GithubModule,
    ModelModule,
    EmbeddingModule,
    SlackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
