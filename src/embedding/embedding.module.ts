import { Module } from '@nestjs/common';
import { NotionEmbeddingService } from './notion_embedding.service';
import { GithubEmbeddingController } from './github_embedding.controller';
import { NotionEmbeddingController } from './notion_embedding.controller';
import { GithubEmbeddingService } from './github_embedding.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [GithubEmbeddingController, NotionEmbeddingController],
  providers: [GithubEmbeddingService, NotionEmbeddingService],
})
export class EmbeddingModule {}
