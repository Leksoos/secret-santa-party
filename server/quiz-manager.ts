import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { INITIAL_QUIZ_QUESTIONS, QuizQuestion } from './quiz-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const CUSTOM_FILE = path.join(DATA_DIR, 'custom-questions.json');

export class QuizManager {
  private builtInQuestions: QuizQuestion[] = [];
  private customQuestions: QuizQuestion[] = [];

  constructor() {
    this.builtInQuestions = [...INITIAL_QUIZ_QUESTIONS];
    this.loadCustomQuestions();
  }

  private loadCustomQuestions() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CUSTOM_FILE)) {
        const raw = fs.readFileSync(CUSTOM_FILE, 'utf-8');
        this.customQuestions = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Could not load custom quiz questions, starting empty:', e);
      this.customQuestions = [];
    }
  }

  private saveCustomQuestions() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CUSTOM_FILE, JSON.stringify(this.customQuestions, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Could not save custom quiz questions:', e);
    }
  }

  public getAllQuestions(): QuizQuestion[] {
    return [...this.builtInQuestions, ...this.customQuestions];
  }

  public getRandomUnusedQuestion(usedIds: string[] | Set<string> = []): QuizQuestion | null {
    const all = this.getAllQuestions();
    const isSet = usedIds instanceof Set;
    const hasUsed = (id: string) => (isSet ? (usedIds as Set<string>).has(id) : (usedIds as string[]).includes(id));
    const unused = all.filter((q) => !hasUsed(q.id));

    if (unused.length === 0) {
      // If exhausted all 120+ questions, recycle questions except the most recent
      return all[Math.floor(Math.random() * all.length)] || null;
    }

    const randomIndex = Math.floor(Math.random() * unused.length);
    return unused[randomIndex];
  }

  public addCustomQuestion(params: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    category?: string;
    authorName?: string;
    author?: string;
  }): QuizQuestion {
    if (!params.question || !params.question.trim()) {
      throw new Error('Текст вопроса не может быть пустым');
    }
    if (
      !params.options ||
      !Array.isArray(params.options) ||
      params.options.length < 2 ||
      params.options.length > 6 ||
      params.options.some((o) => typeof o !== 'string' || !o.trim())
    ) {
      throw new Error('Необходимо заполнить варианты ответов (от 2 до 6)');
    }
    if (
      typeof params.correctIndex !== 'number' ||
      params.correctIndex < 0 ||
      params.correctIndex >= params.options.length
    ) {
      throw new Error(`Индекс правильного ответа должен быть от 0 до ${params.options.length - 1}`);
    }
    if (!params.explanation || !params.explanation.trim()) {
      throw new Error('Пожалуйста, укажите объяснение («Почему именно так?»)');
    }

    const newQuestion: QuizQuestion = {
      id: `custom-${uuidv4()}`,
      question: params.question.trim(),
      options: params.options.map((o) => o.trim()),
      correctIndex: params.correctIndex,
      explanation: params.explanation.trim(),
      category: params.category?.trim() || '💡 Вопрос от гостей',
      isCustom: true,
      authorName: params.authorName?.trim() || params.author?.trim(),
    };

    this.customQuestions.push(newQuestion);
    this.saveCustomQuestions();
    return newQuestion;
  }

  public getQuizStats() {
    const all = this.getAllQuestions();
    const categories: Record<string, number> = {};

    all.forEach((q) => {
      categories[q.category] = (categories[q.category] || 0) + 1;
    });

    return {
      totalQuestions: all.length,
      builtinCount: this.builtInQuestions.length,
      builtInCount: this.builtInQuestions.length,
      customCount: this.customQuestions.length,
      categories,
    };
  }
}

export const quizManager = new QuizManager();
