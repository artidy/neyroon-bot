import prisma from '../database/prisma';
import { UserStatus } from '@prisma/client';

export class UserService {
  async findOrCreateUser(telegramId: number, username?: string, firstName?: string, lastName?: string) {
    let user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        subscriptions: {
          where: {
            status: 'completed',
            endDate: {
              gte: new Date(),
            },
          },
          orderBy: {
            endDate: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId: BigInt(telegramId),
          username,
          firstName,
          lastName,
          status: UserStatus.NEW,
        },
        include: {
          subscriptions: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastActivityAt: new Date(),
        },
      });
    }

    return user;
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    return await prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async setUserAsNewbie(userId: string, isNewbie: boolean) {
    const status = isNewbie ? UserStatus.TRIAL : UserStatus.NEW;
    return await prisma.user.update({
      where: { id: userId },
      data: {
        isNewbie,
        status,
        currentLessonDay: isNewbie ? 1 : 0,
      },
    });
  }

  async setPreferredTime(userId: string, time: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: { preferredTime: time },
    });
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const activeSub = await prisma.subscription.findFirst({
      where: {
        userId,
        status: 'completed',
        endDate: {
          gte: new Date(),
        },
      },
    });

    return !!activeSub;
  }

  async incrementLessonDay(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    return await prisma.user.update({
      where: { id: userId },
      data: {
        currentLessonDay: user.currentLessonDay + 1,
      },
    });
  }

  async getUserByTelegramId(telegramId: number) {
    return await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        subscriptions: {
          where: {
            status: 'completed',
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        drawings: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });
  }

  async getAllUsers() {
    return await prisma.user.findMany({
      include: {
        subscriptions: true,
        drawings: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getUserStats() {
    const total = await prisma.user.count();
    const active = await prisma.user.count({
      where: { status: UserStatus.ACTIVE },
    });
    const trial = await prisma.user.count({
      where: { status: UserStatus.TRIAL },
    });
    const newUsers = await prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    });

    return {
      total,
      active,
      trial,
      newUsers,
    };
  }

  async resetUserOnboarding(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        isNewbie: null,
        status: UserStatus.NEW,
        currentLessonDay: 0,
        acceptedPolicy: false,
      },
    });
  }

  async acceptPolicy(userId: string) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        acceptedPolicy: true,
      },
    });
  }
}

export default new UserService();
