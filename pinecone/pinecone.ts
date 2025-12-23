import { FactoryProvider, Scope } from '@nestjs/common';
import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const NotionPineconeProvider: FactoryProvider<PineconeStore> = {
  scope: Scope.REQUEST,
  durable: true,
  provide: 'NOTION_PINECONE_CLIENT',
  inject: [PrismaService, REQUEST, ConfigService, 'EMBEDDING_MODEL'],
  useFactory: async (
    prisma: PrismaService,
    ctxPayload: { tenantId: string },
    config: ConfigService,
    embeddings: OpenAIEmbeddings,
  ) => {
    const tenant = await prisma.tenants.findFirstOrThrow({
      where: { tenantId: ctxPayload.tenantId },
    });
    const pinecone = new Pinecone({ apiKey: config.get('PINECONE_API_KEY') });
    const index = pinecone.Index(config.get('PINECONE_NOTION_INDEX_NAME'));
    return PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: tenant.tenantId,
    });
  },
};

export const GithubPineconeProvider: FactoryProvider<PineconeStore> = {
  scope: Scope.REQUEST,
  durable: true,
  provide: 'GITHUB_PINECONE_CLIENT',
  inject: [PrismaService, REQUEST, ConfigService, 'EMBEDDING_MODEL'],
  useFactory: async (
    prisma: PrismaService,
    ctxPayload: { tenantId: string },
    config: ConfigService,
    embeddings: OpenAIEmbeddings,
  ) => {
    const tenant = await prisma.tenants.findFirstOrThrow({
      where: { tenantId: ctxPayload.tenantId },
    });
    const pinecone = new Pinecone({ apiKey: config.get('PINECONE_API_KEY') });
    const index = pinecone.Index(config.get('PINECONE_GITHUB_INDEX_NAME'));
    return PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: tenant.tenantId,
    });
  },
};
