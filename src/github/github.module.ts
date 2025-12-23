import { Module } from '@nestjs/common';
import { GithubService } from './github.service';
import { PineconeModule } from '../../pinecone/pinecone.module';
import { ModelModule } from '../../model/model.module';

@Module({
  imports: [PineconeModule, ModelModule],
  providers: [GithubService],
  exports: [GithubService],
})
export class GithubModule {}
