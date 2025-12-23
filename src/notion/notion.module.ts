import { Module } from '@nestjs/common';
import { NotionService } from './notion.service';
import { PineconeModule } from '../../pinecone/pinecone.module';
import { ModelModule } from '../../model/model.module';

@Module({
  imports: [PineconeModule, ModelModule],
  providers: [NotionService],
  exports: [NotionService],
})
export class NotionModule {}
