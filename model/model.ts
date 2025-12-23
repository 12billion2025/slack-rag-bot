import { FactoryProvider } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

export const LlmModelProvider: FactoryProvider<ChatOpenAI> = {
  provide: 'LLM_MODEL',
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new ChatOpenAI({
      apiKey: config.get('OPENAI_API_KEY'),
      modelName: config.get('OPENAI_DEFAULT_MODEL'),
      configuration: { baseURL: config.get('OPENAI_BASE_URL') },
      temperature: 0.7,
    });
  },
};

export class GoogleEmbeddings {
  private ai: GoogleGenAI;
  private model: string;
  private dimensions: number;

  constructor(options: { apiKey?: string; model: string; dimensions: number }) {
    this.ai = new GoogleGenAI({
      apiKey: options.apiKey,
    });
    this.model = options.model;
    this.dimensions = options.dimensions;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.ai.models.embedContent({
      model: this.model,
      contents: text,
      config: { outputDimensionality: this.dimensions },
    });
    return response.embeddings?.[0]?.values || [];
  }
}

export const EmbeddingModelProvider: FactoryProvider<GoogleEmbeddings> = {
  provide: 'EMBEDDING_MODEL',
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    return new GoogleEmbeddings({
      apiKey: config.get('OPENAI_API_KEY'),
      model: config.get('OPENAI_EMBEDDING_MODEL') || 'gemini-embedding-001',
      dimensions: 768,
    });
  },
};
