export interface BotConfig {
  token: string;
  adminPort: number;
}

export interface DatabaseConfig {
  url: string;
}

export interface PaymentConfig {
  yukassa: {
    shopId: string;
    secretKey: string;
  };
  kaspi: {
    merchantId: string;
    merchantSecret: string;
  };
  prodamus: {
    apiKey: string;
    secretKey: string;
    projectId: string;
  };
  price: number;
  currency: string;
  durationDays: number;
}

export interface LessonSchedule {
  userId: string;
  lessonNumber: number;
  scheduledTime: Date;
}

export interface UserContext {
  telegramId: number;
  isNewbie?: boolean;
  currentStep?: string;
}
