import { Injectable, Logger } from '@nestjs/common';
import { GenerateGuideDto } from './dto/generate-guide.dto';

type GeneratedGuide = {
  overview: string;
  tips: string[];
  dayPlan: { day: number; title: string; stops: string[] }[];
};

@Injectable()
export class GuideService {
  private readonly logger = new Logger(GuideService.name);
  private readonly apiKey = process.env.OPENROUTER_API_KEY;
  private readonly model =
    (process.env.OPENROUTER_MODEL || '').trim() || 'gpt-4o-mini';

  async generate(dto: GenerateGuideDto): Promise<GeneratedGuide> {
    if (!this.apiKey) {
      this.logger.warn('OPENROUTER_API_KEY не задан, возвращаем заглушку');
      return this.buildFallback(dto);
    }

    const prompt = this.buildPrompt(dto);
    const payload = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'Ты туристический ассистент. Дай краткий обзор, 3-5 советов и план по дням. Верни строго JSON без лишнего текста.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    };

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      if (!res.ok) {
        this.logger.warn(`OpenRouter error ${res.status}: ${raw}`);
        return this.buildFallback(dto);
      }

      const data = JSON.parse(raw) as any;
      const content = data?.choices?.[0]?.message?.content;
      if (!content) {
        this.logger.warn('OpenRouter: пустой content');
        return this.buildFallback(dto);
      }

      const parsed = JSON.parse(content) as GeneratedGuide;
      return this.normalizeGuide(parsed, dto);
    } catch (e) {
      this.logger.error(`OpenRouter request failed: ${e}`);
      return this.buildFallback(dto);
    }
  }

  private buildPrompt(dto: GenerateGuideDto): string {
    const days = dto.days ?? 2;
    const tags = (dto.tags ?? []).filter((t) => t.trim().length > 0).join(', ');
    const routes = (dto.routes ?? [])
      .map(
        (r) =>
          `${r.title}${r.days ? ` (${r.days}д)` : ''}: ${r.desc ?? ''} ${
            r.tags ? `теги: ${r.tags?.join(', ')}` : ''
          }`,
      )
      .join('; ');

    return [
      `Город: ${dto.city}`,
      `Дней: ${days}`,
      tags ? `Темы/теги: ${tags}` : '',
      routes ? `Доступные маршруты: ${routes}` : '',
      'Верни JSON: { "overview": "", "tips": ["..."], "dayPlan": [ { "day": 1, "title": "", "stops": ["..."] } ] }',
    ]
      .filter((line) => line.trim().length > 0)
      .join('\n');
  }

  private normalizeGuide(guide: GeneratedGuide, dto: GenerateGuideDto): GeneratedGuide {
    const days = dto.days ?? 2;
    const overview =
      typeof guide.overview === 'string' && guide.overview.trim().length > 0
        ? guide.overview.trim()
        : `План на ${days} ${days === 1 ? 'день' : 'дня'} в городе ${dto.city}.`;

    const tips = (guide.tips ?? [])
      .map((t) => (t || '').trim())
      .filter((t) => t.length > 0);

    const dayPlan =
      (guide.dayPlan ?? [])
        .map((d) => ({
          day: d.day ?? 1,
          title: (d.title || `День ${d.day ?? 1}`).trim(),
          stops: (d.stops ?? [])
            .map((s) => (s || '').trim())
            .filter((s) => s.length > 0),
        }))
        .filter((d) => d.stops.length > 0) || [];

    return { overview, tips, dayPlan };
  }

  private buildFallback(dto: GenerateGuideDto): GeneratedGuide {
    const days = dto.days ?? 2;
    return {
      overview: `Маршрут на ${days} ${days === 1 ? 'день' : 'дня'} в городе ${dto.city}.`,
      tips: [
        'Забронируйте популярные места заранее.',
        'Сочетайте прогулки пешком и транспорт.',
        'Уточните расписание музеев и площадок.',
      ],
      dayPlan: Array.from({ length: days }).map((_, i) => {
        const day = i + 1;
        return {
          day,
          title: `День ${day}`,
          stops: [
            'Исторический центр',
            'Кофейня или рынок',
            'Парк или набережная',
          ],
        };
      }),
    };
  }
}
