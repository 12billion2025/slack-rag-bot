import { Body, Controller, Logger, Post, Res, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotionEmbeddingService } from './notion_embedding.service';
import { ApiKeyGuard } from '../api-key.guard';
import { VercelCronGuard } from '../vercel-cron.guard';
import { Response } from 'express';

@Controller('notion-embedding')
export class NotionEmbeddingController {
  private readonly logger = new Logger(NotionEmbeddingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notionEmbeddingService: NotionEmbeddingService,
  ) {}

  @Post('update')
  @UseGuards(VercelCronGuard)
  async updateEmbedding(@Res() res: Response) {
    const tenants = await this.prisma.tenants.findMany({
      where: {
        notionApiKey: { not: null },
        notionDatabaseId: { not: null },
      },
    });

    for (const tenant of tenants) {
      try {
        await this.notionEmbeddingService.updateNotionPinecone(tenant);
        this.logger.log('Notion 임베딩 업데이트 완료');
        res.status(200).json({ message: 'Notion 임베딩 업데이트 완료' });
      } catch (error) {
        this.logger.error(
          `테넌트 ${tenant.tenantId}의 Notion 임베딩 업데이트 실패:`,
          error,
        );
      }
    }
  }

  @Post('init')
  @UseGuards(ApiKeyGuard)
  async initEmbedding(
    @Body() body: { tenantId: string },
    @Res() res: Response,
  ) {
    const tenant = await this.prisma.tenants.findFirstOrThrow({
      where: { tenantId: body.tenantId },
      orderBy: { updatedAt: 'desc' },
    });

    try {
      await this.notionEmbeddingService.initNotionPinecone(tenant);
      this.logger.log('Notion 임베딩 초기화 완료');
      res.status(200).json({ message: 'Notion 임베딩 초기화 완료' });
    } catch (error) {
      console.log(error);
      this.logger.error(
        `테넌트 ${tenant.tenantId}의 Notion 임베딩 초기화 실패:`,
        error,
      );
    }
  }
}
