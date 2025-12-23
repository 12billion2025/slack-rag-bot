import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { Pinecone } from '@pinecone-database/pinecone';
import { Tenants } from '@prisma/client';
import { Client } from '@notionhq/client';
import { GoogleEmbeddings } from '../../model/model';

@Injectable()
export class NotionEmbeddingService {
  private readonly logger = new Logger(NotionEmbeddingService.name);
  private readonly pinecone = new Pinecone({
    apiKey: this.configService.getOrThrow<string>('PINECONE_API_KEY')!,
  });
  private readonly pineconeIndex = this.pinecone.Index(
    this.configService.getOrThrow<string>('PINECONE_NOTION_INDEX_NAME')!,
  );
  private readonly embeddings = new GoogleEmbeddings({
    apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY')!,
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

  public async updateNotionPinecone(tenant: Tenants) {
    this.logger.log(`테넌트 ${tenant.tenantId}의 Notion 임베딩 업데이트 시작`);

    const pineconeStore = this.pineconeIndex.namespace(tenant.tenantId);
    const notion = new Client({ auth: tenant.notionApiKey });

    try {
      const pages = await this.getRecentlyEditedPages(
        notion,
        tenant.notionDatabaseId!,
        1,
      );
      this.logger.log(`처리할 페이지 수: ${pages.length}`);

      let totalProcessedPages = 0;
      let totalChunks = 0;

      for (const page of pages) {
        try {
          // 기존 임베딩 삭제 (중복 방지)
          await this.deleteExistingEmbeddings(pineconeStore, page.id);

          const content = await this.getPageBlocksText(notion, page.id);

          if (!content.trim()) {
            this.logger.warn(`페이지 ${page.id}에 내용이 없습니다.`);
            continue;
          }

          // 텍스트를 청크로 분할
          const chunks = await this.textSplitter.splitText(content);

          // 각 청크에 대해 임베딩 생성 및 저장
          const vectors = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkId = this.createChunkId(page.id, i);

            // 임베딩 생성
            const embedding = await this.embeddings.embedQuery(chunk);

            // 메타데이터 생성
            const metadata = {
              pageId: page.id,
              chunkIndex: i,
              totalChunks: chunks.length,
              lastEdited: page.last_edited_time,
              source: 'notion',
              title:
                page.properties?.title?.title?.[0]?.plain_text || 'Untitled',
              pageContent: chunk,
              updatedAt: new Date().toISOString(),
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
            totalProcessedPages++;

            this.logger.log(
              `페이지 처리 완료: ${page.id} (${vectors.length}개 청크)`,
            );
          }
        } catch (error) {
          this.logger.error(`페이지 ${page.id} 처리 중 오류:`, error);
        }
      }

      this.logger.log(
        `Notion 임베딩 업데이트 완료: ${totalProcessedPages}개 페이지, ${totalChunks}개 청크`,
      );
    } catch (error) {
      this.logger.error('Notion 임베딩 업데이트 중 오류 발생:', error);
      throw error;
    }
  }

  public async initNotionPinecone(tenant: Tenants) {
    this.logger.log(`테넌트 ${tenant.tenantId}의 Notion 임베딩 초기화 시작`);

    const pineconeStore = this.pineconeIndex.namespace(tenant.tenantId);
    const notion = new Client({
      auth: tenant.notionApiKey,
      notionVersion: '2022-06-28',
    });

    try {
      const pages = await this.getAllPages(notion, tenant.notionDatabaseId);
      this.logger.log(`초기화할 페이지 수: ${pages.length}`);

      let totalProcessedPages = 0;
      let totalChunks = 0;

      for (const page of pages) {
        try {
          const content = await this.getPageBlocksText(notion, page.id);

          if (!content.trim()) {
            this.logger.warn(`페이지 ${page.id}에 내용이 없습니다.`);
            continue;
          }

          // 텍스트를 청크로 분할
          const chunks = await this.textSplitter.splitText(content);

          // 각 청크에 대해 임베딩 생성 및 저장
          const vectors = [];

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const chunkId = this.createChunkId(page.id, i);

            // 임베딩 생성
            const embedding = await this.embeddings.embedQuery(chunk);

            // 메타데이터 생성
            const metadata = {
              pageId: page.id,
              chunkIndex: i,
              totalChunks: chunks.length,
              lastEdited: page.last_edited_time,
              source: 'notion',
              title:
                page.properties?.title?.title?.[0]?.plain_text || 'Untitled',
              pageContent: chunk,
              updatedAt: new Date().toISOString(),
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
            totalProcessedPages++;

            this.logger.log(
              `페이지 처리 완료: ${page.id} (${vectors.length}개 청크)`,
            );
          }
        } catch (error) {
          this.logger.error(`페이지 ${page.id} 처리 중 오류:`, error);
        }
      }

      this.logger.log(
        `Notion 임베딩 초기화 완료: ${totalProcessedPages}개 페이지, ${totalChunks}개 청크`,
      );
    } catch (error) {
      this.logger.error('Notion 임베딩 초기화 중 오류 발생:', error);
      throw error;
    }
  }

  private async getRecentlyEditedPages(
    notion: Client,
    databaseId: string,
    hoursAgo: number = 1,
  ): Promise<any[]> {
    const since = new Date(
      Date.now() - hoursAgo * 60 * 60 * 1000,
    ).toISOString();

    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: '작성일시',
        date: {
          on_or_after: since,
        },
      },
      sorts: [
        {
          property: '작성일시',
          direction: 'descending',
        },
      ],
    });

    return response.results;
  }

  private async getAllPages(
    notion: Client,
    databaseId: string,
  ): Promise<any[]> {
    const response = await notion.databases.query({
      database_id: databaseId,
    });

    return response.results;
  }

  private async getPageBlocksText(
    notion: Client,
    pageId: string,
  ): Promise<string> {
    const blocks = await notion.blocks.children.list({ block_id: pageId });

    const texts = blocks.results
      .map((block: any) => {
        if (block.type === 'paragraph') {
          return block.paragraph.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        if (block.type === 'heading_1') {
          return block.heading_1.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        if (block.type === 'heading_2') {
          return block.heading_2.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        if (block.type === 'heading_3') {
          return block.heading_3.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        if (block.type === 'bulleted_list_item') {
          return block.bulleted_list_item.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        if (block.type === 'numbered_list_item') {
          return block.numbered_list_item.rich_text
            .map((t: any) => t.plain_text)
            .join('');
        }
        return '';
      })
      .filter((text) => text.trim() !== '');

    return texts.join('\n');
  }

  private createChunkId(pageId: string, chunkIndex: number): string {
    return `notion_${pageId}_chunk_${chunkIndex}`;
  }

  private async deleteExistingEmbeddings(pineconeStore: any, pageId: string) {
    try {
      // prefix를 사용하여 해당 페이지의 모든 벡터 ID 찾기
      const prefix = `notion_${pageId}_chunk_`;
      const listResult = await pineconeStore.listPaginated({
        prefix: prefix,
      });

      if (listResult.vectors && listResult.vectors.length > 0) {
        // 찾은 벡터 ID들을 삭제
        const ids = listResult.vectors.map((v: any) => v.id);
        await pineconeStore.deleteMany(ids);
        this.logger.log(
          `기존 페이지 삭제 완료: ${pageId} (${ids.length}개 벡터)`,
        );
      } else {
        this.logger.log(`삭제할 벡터 없음: ${pageId}`);
      }
    } catch (error) {
      this.logger.error(`기존 페이지 삭제 실패:`, error);
    }
  }
}
