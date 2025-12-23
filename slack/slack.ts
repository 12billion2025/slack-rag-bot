import { FactoryProvider, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { WebClient } from '@slack/web-api';

export const SlackProvider: FactoryProvider<WebClient> = {
  scope: Scope.REQUEST,
  durable: true,
  provide: 'SLACK_CLIENT',
  inject: [PrismaService, REQUEST],
  useFactory: async (
    prisma: PrismaService,
    ctxPayload: { tenantId: string },
  ) => {
    const tenant = await prisma.tenants.findFirst({
      where: { tenantId: ctxPayload.tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    const slackClient = new WebClient(tenant.slackBotToken);
    return slackClient;
  },
};
