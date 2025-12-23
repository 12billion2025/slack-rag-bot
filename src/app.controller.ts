import { Body, Controller, Inject, Post, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { SlackEventSubscription } from '@types';
import { Response } from 'express';
import { WebClient } from '@slack/web-api';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject('SLACK_CLIENT') private readonly slackClient: WebClient,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  @Post()
  async subscribeSlackEvent(
    @Body() { event, event_id }: SlackEventSubscription,
    @Res() res: Response,
  ) {
    try {
      const isProcessed = await this.cacheManager.get(`event:${event_id}`);
      if (isProcessed) return res.status(200).send();

      await this.cacheManager.set(`event:${event_id}`, true, 60000);
      const reply = await this.appService.createCompletions(
        event.text,
        event.channel,
        event.thread_ts || event.ts,
      );
      await this.slackClient.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: reply,
      });
      res.status(200).send();
    } catch (error) {
      await this.slackClient.chat.postMessage({
        channel: event.channel,
        thread_ts: event.ts,
        text: '오류가 발생했습니다. 다시 시도해주세요.',
      });
      console.error(error);
    }
  }
}
