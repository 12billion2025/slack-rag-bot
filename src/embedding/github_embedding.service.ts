import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Tenants } from '@prisma/client';
import { Index, Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { Octokit } from '@octokit/rest';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { excludedDirs, supportedExtensions } from '../constants';
import { GoogleEmbeddings } from '../../model/model';

@Injectable()
export class GithubEmbeddingService {
  private readonly logger = new Logger(GithubEmbeddingService.name);
  private readonly pinecone = new Pinecone({
    apiKey: this.configService.get<string>('PINECONE_API_KEY')!,
  });
  private readonly pineconeIndex = this.pinecone.Index(
    this.configService.get<string>('PINECONE_GITHUB_INDEX_NAME')!,
  );
  private readonly embeddings = new GoogleEmbeddings({
    apiKey: this.configService.get('OPENAI_API_KEY'),
    model:
      this.configService.get('OPENAI_EMBEDDING_MODEL') ||
      'gemini-embedding-001',
    dimensions: 768,
  });
  private readonly textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  constructor(private readonly configService: ConfigService) {}

  public async updateGitubPinecone(
    tenant: Tenants,
    getFileFunction: (
      octokit: Octokit,
      owner: string,
      repo: string,
    ) => Promise<any>,
  ) {
    this.logger.log(`테넌트 ${tenant.id}의 GitHub 임베딩 업데이트 시작`);

    const pineconeStore = this.pineconeIndex.namespace(tenant.tenantId);
    const octokit = new Octokit({ auth: tenant.githubAccessToken });

    try {
      const repositories = await this.getAllRepositories(octokit);

      this.logger.log(`${repositories.length}개의 레포지토리 발견`);

      let totalProcessedFiles = 0;
      let totalChunks = 0;

      for (const repo of repositories) {
        try {
          this.logger.log(`레포지토리 처리 중: ${repo.full_name}`);

          const changedFiles = await getFileFunction(
            octokit,
            repo.owner.login,
            repo.name,
          );

          if (changedFiles.length === 0) {
            this.logger.log(
              `${repo.full_name}: 최근 30분 동안 변경된 파일 없음`,
            );
            continue;
          }

          this.logger.log(
            `${repo.full_name}: ${changedFiles.length}개의 최근 변경된 파일 발견`,
          );

          for (const file of changedFiles) {
            const filename = file.filename || file.path;
            try {
              // 지원하는 파일 확장자인지 확인
              if (!this.isSupportedFile(filename)) {
                console.log('not supported file', filename);
                continue;
              }

              // 파일이 삭제된 경우 임베딩만 삭제하고 건너뛰기
              if (file.status === 'removed') {
                await this.deleteExistingEmbeddings(
                  pineconeStore,
                  repo.full_name,
                  filename,
                );
                this.logger.log(`삭제된 파일의 임베딩 제거 완료: ${filename}`);
                continue;
              }

              // 파일 내용 가져오기
              const content = await this.getFileContent(
                octokit,
                repo.owner.login,
                repo.name,
                filename,
              );

              // 기존 임베딩 삭제 (파일이 수정된 경우)
              await this.deleteExistingEmbeddings(
                pineconeStore,
                repo.full_name,
                filename,
              );

              if (!content) {
                console.log('no content', filename);
                continue;
              }

              // 텍스트를 청크로 분할
              const chunks = await this.textSplitter.splitText(content);

              // 각 청크에 대해 임베딩 생성 및 저장
              const vectors = [];

              for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkId = this.createChunkId(repo.full_name, filename, i);

                // 임베딩 생성
                const embedding = await this.embeddings.embedQuery(chunk);

                // 메타데이터 생성
                const metadata = {
                  repository: repo.full_name,
                  filePath: filename,
                  chunkIndex: i,
                  totalChunks: chunks.length,
                  status: file.status, // added, modified, removed
                  additions: file.additions || 0,
                  deletions: file.deletions || 0,
                  changes: file.changes || 0,
                  repoUrl: repo.html_url,
                  language: repo.language || 'unknown',
                  updatedAt: new Date().toISOString(),
                  pageContent: chunk,
                  timestamp: new Date().toISOString(),
                };

                vectors.push({
                  id: chunkId,
                  values: embedding,
                  metadata,
                });
              }

              // Pinecone에 벡터 업로드
              if (vectors.length > 0) {
                await pineconeStore.upsert(vectors);
                totalChunks += vectors.length;
                totalProcessedFiles++;

                this.logger.log(
                  `파일 처리 완료: ${filename} (${file.status}) (${vectors.length}개 청크)`,
                );
              }
            } catch (error) {
              this.logger.warn(`파일 처리 실패 ${filename}:`, error);
            }
          }
        } catch (error) {
          this.logger.warn(`레포지토리 처리 실패 ${repo.full_name}:`, error);
        }
      }

      this.logger.log(
        `GitHub 임베딩 업데이트 완료: ${totalProcessedFiles}개 파일, ${totalChunks}개 청크`,
      );
    } catch (error) {
      this.logger.error('GitHub 임베딩 업데이트 중 오류 발생:', error);
      console.log(error);
      throw error;
    }
  }

  public async getRepositoryFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    path = '',
  ) {
    const files = [];

    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      const contents = Array.isArray(response.data)
        ? response.data
        : [response.data];

      for (const item of contents) {
        if (item.type === 'file') {
          files.push(item);
        } else if (item.type === 'dir' && !excludedDirs.has(item.name)) {
          // 재귀적으로 디렉토리 탐색
          const subFiles = await this.getRepositoryFiles(
            octokit,
            owner,
            repo,
            item.path,
          );
          files.push(...subFiles);
        }
      }
    } catch (error) {
      this.logger.warn(`디렉토리 읽기 실패 ${owner}/${repo}/${path}:`, error);
    }

    return files;
  }

  public async getRecentlyChangedFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
  ) {
    const changedFiles = [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000 * 24).toISOString();

    try {
      // 최근 30분 이후의 커밋들 가져오기
      const commits = await octokit.repos.listCommits({
        owner,
        repo,
        since: oneHourAgo,
        per_page: 100,
      });

      this.logger.log(
        `${owner}/${repo}: ${commits.data.length}개의 최근 커밋 발견`,
      );

      // 각 커밋에서 변경된 파일들 추출
      for (const commit of commits.data) {
        try {
          const commitDetail = await octokit.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });

          // 변경된 파일들을 changedFiles 배열에 추가
          if (commitDetail.data.files) {
            for (const file of commitDetail.data.files) {
              // 중복 제거를 위해 기존에 없는 파일만 추가
              if (!changedFiles.some((f) => f.filename === file.filename)) {
                changedFiles.push({
                  filename: file.filename,
                  status: file.status, // added, modified, removed, renamed
                  additions: file.additions,
                  deletions: file.deletions,
                  changes: file.changes,
                  patch: file.patch,
                });
              }
            }
          }
        } catch (error) {
          this.logger.warn(
            `커밋 상세 정보 가져오기 실패 ${commit.sha}:`,
            error,
          );
        }
      }

      this.logger.log(
        `${owner}/${repo}: 총 ${changedFiles.length}개의 변경된 파일`,
      );
      return changedFiles;
    } catch (error) {
      this.logger.error(`최근 변경된 파일 조회 실패 ${owner}/${repo}:`, error);
      return [];
    }
  }

  private async getAllRepositories(octokit: Octokit) {
    const repositories = [];
    let page = 1;
    const perPage = 10;

    try {
      // GitHub App의 경우 installation repositories 사용
      while (true) {
        const response = await octokit.apps.listReposAccessibleToInstallation({
          page,
          per_page: perPage,
        });

        repositories.push(...response.data.repositories);

        if (response.data.repositories.length < perPage) {
          break;
        }
        page++;
      }
    } catch (error) {
      this.logger.warn(
        'Installation repositories 접근 실패, 대체 방법 시도:',
        error,
      );
    }

    return repositories;
  }

  private async getFileContent(
    octokit: Octokit,
    owner: string,
    repo: string,
    path: string,
  ) {
    try {
      const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      const data = response.data as any;
      if (data.content && data.encoding === 'base64') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch (error) {
      this.logger.warn(`파일 내용 읽기 실패 ${owner}/${repo}/${path}:`, error);
    }

    return null;
  }

  private isSupportedFile(filePath: string): boolean {
    const extension = filePath.substring(filePath.lastIndexOf('.'));
    return supportedExtensions.has(extension);
  }

  private createChunkId(
    repoName: string,
    filePath: string,
    chunkIndex: number,
  ): string {
    return `${repoName}:${filePath}:${chunkIndex}`;
  }

  private async deleteExistingEmbeddings(
    pineconeStore: Index<RecordMetadata>,
    repository: string,
    filePath: string,
  ) {
    try {
      const prefix = `${repository}:${filePath}:`;
      const listResult = await pineconeStore.listPaginated({ prefix });

      if (listResult.vectors && listResult.vectors.length > 0) {
        const ids = listResult.vectors.map((v: any) => v.id);
        await pineconeStore.deleteMany(ids);
        this.logger.log(
          `기존 파일 삭제 완료: ${repository}/${filePath} (${ids.length}개 벡터)`,
        );
      } else {
        this.logger.log(`삭제할 벡터 없음: ${repository}/${filePath}`);
      }
    } catch (error) {
      console.log(error);
      this.logger.log(`기존 파일 삭제 실패:`, error);
    }
  }
}
