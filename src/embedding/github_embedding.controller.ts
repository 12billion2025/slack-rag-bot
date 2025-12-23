import { Body, Controller, Logger, Post, Res, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GithubEmbeddingService } from './github_embedding.service';
import { ApiKeyGuard } from '../api-key.guard';
import { VercelCronGuard } from '../vercel-cron.guard';
import { Response } from 'express';

@Controller('github-embedding')
export class GithubEmbeddingController {
  private readonly logger = new Logger(GithubEmbeddingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubEmbeddingService: GithubEmbeddingService,
  ) {}

  @Post('update')
  @UseGuards(VercelCronGuard)
  async updateEmbedding(@Res() res: Response) {
    const tenants = await this.prisma.tenants.findMany();

    for (const tenant of tenants) {
      try {
        await this.githubEmbeddingService.updateGitubPinecone(
          tenant,
          (octokit, owner, repo) =>
            this.githubEmbeddingService.getRecentlyChangedFiles(
              octokit,
              owner,
              repo,
            ),
        );
        this.logger.log('GitHub 임베딩 업데이트 완료');
        res.status(200).json({ message: 'GitHub 임베딩 업데이트 완료' });
      } catch (error) {
        this.logger.error(
          `테넌트 ${tenant.id}의 GitHub 임베딩 업데이트 실패:`,
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
      await this.githubEmbeddingService.updateGitubPinecone(
        tenant,
        (octokit, owner, repo) =>
          this.githubEmbeddingService.getRepositoryFiles(octokit, owner, repo),
      );

      console.log('GitHub 임베딩 초기화 완료');
      res.status(200).json({ message: 'GitHub 임베딩 초기화 완료' });
    } catch (error) {
      this.logger.error(
        `테넌트 ${tenant.id}의 GitHub 임베딩 업데이트 실패:`,
        error,
      );
    }
  }
}
