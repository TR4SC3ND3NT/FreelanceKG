/**
 * Freelancer Routes
 * GET /api/freelancers - Search freelancers
 * GET /api/freelancers/:id - Get freelancer profile
 * PUT /api/freelancers/profile - Update my profile
 * GET /api/freelancers/:id/reviews - Get reviews
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { freelancerOnly } from '../middleware/roleGuard';
import { validate, updateProfileSchema, freelancerQuerySchema } from '../lib/validation';
import { logger } from '../lib/logger';
import { getFreelancerPaymentDetails, saveFreelancerPaymentDetails } from '../lib/userSettings';

const router = Router();

// ============================================
// SEARCH FREELANCERS
// ============================================

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      category,
      search,
      minRating,
      maxPrice,
      skills,
      page = 1,
      limit = 12,
      sortBy = 'rating',
    } = req.query;

    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.max(1, Number(limit) || 12);
    const skip = (pageNumber - 1) * limitNumber;

    const profileWhere: any = {};

    // Filter by category
    if (category) {
      profileWhere.category = category as string;
    }

    // Filter by rating
    if (minRating !== undefined && minRating !== null && String(minRating).trim() !== '') {
      profileWhere.rating = { gte: Number(minRating) };
    }

    // Filter by price
    if (maxPrice !== undefined && maxPrice !== null && String(maxPrice).trim() !== '') {
      profileWhere.hourlyRate = { lte: Number(maxPrice) };
    }

    // Filter by skills
    if (skills) {
      const skillArray = (skills as string).split(',').map((s) => s.trim()).filter(Boolean);
      if (skillArray.length > 0) {
        profileWhere.skills = { hasSome: skillArray };
      }
    }

    const where: any = {
      role: 'FREELANCER',
      freelancerProfile: {
        is: profileWhere,
      },
    };

    // Search by name or skills
    if (search) {
      const query = (search as string).trim();
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { freelancerProfile: { is: { skills: { hasSome: [query] } } } },
        { freelancerProfile: { is: { bio: { contains: query, mode: 'insensitive' } } } },
      ];
    }

    // Sorting
    let orderBy: any = {};
    switch (sortBy) {
      case 'rating':
        orderBy = { freelancerProfile: { rating: 'desc' } };
        break;
      case 'price':
        orderBy = { freelancerProfile: { hourlyRate: 'asc' } };
        break;
      case 'orders':
        orderBy = { freelancerProfile: { completedOrders: 'desc' } };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      default:
        orderBy = { freelancerProfile: { rating: 'desc' } };
    }
    
    const [freelancers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          avatar: true,
          createdAt: true,
          freelancerProfile: {
            select: {
              id: true,
              bio: true,
              skills: true,
              hourlyRate: true,
              category: true,
              rating: true,
              totalRatings: true,
              completedOrders: true,
              isVerified: true,
              isAvailable: true,
              responseTime: true,
            },
          },
        },
        orderBy,
        skip,
        take: limitNumber,
      }),
      prisma.user.count({ where }),
    ]);
    
    res.json({
      success: true,
      data: freelancers,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET FREELANCER BY ID
// ============================================

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const freelancer = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        avatar: true,
        createdAt: true,
        freelancerProfile: {
          select: {
            id: true,
            bio: true,
            skills: true,
            hourlyRate: true,
            category: true,
            portfolio: true,
            rating: true,
            totalRatings: true,
            completedOrders: true,
            totalEarnings: true,
            isVerified: true,
            isAvailable: true,
            responseTime: true,
            verifiedAt: true,
          },
        },
        reviewsReceived: {
          select: {
            id: true,
            rating: true,
            comment: true,
            response: true,
            createdAt: true,
            from: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            order: {
              select: {
                id: true,
                title: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    
    if (!freelancer) {
      return res.status(404).json({
        success: false,
        error: 'Фрилансер не найден',
      });
    }
    
    if (!freelancer.freelancerProfile) {
      return res.status(404).json({
        success: false,
        error: 'Профиль фрилансера не найден',
      });
    }
    
    // Get stats
    const stats = await prisma.order.aggregate({
      where: {
        freelancerId: id,
        status: 'COMPLETED',
      },
      _count: { id: true },
      _avg: { budget: true },
    });
    
    res.json({
      success: true,
      data: {
        ...freelancer,
        stats: {
          completedOrders: stats._count.id,
          avgOrderValue: Math.round(Number(stats._avg.budget || 0)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE MY PROFILE
// ============================================

router.put('/profile', authMiddleware, freelancerOnly, validate(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { name, bio, skills, hourlyRate, category, portfolio, paymentDetails } = req.body;

    if (name !== undefined) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }
    
    // Check if profile exists
    let profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });
    
    if (!profile) {
      // Create profile if doesn't exist
      profile = await prisma.freelancerProfile.create({
        data: {
          userId: user.id,
          bio,
          skills: skills || [],
          hourlyRate: hourlyRate || 500,
          category,
          portfolio: portfolio || [],
        },
      });
    } else {
      // Update profile
      profile = await prisma.freelancerProfile.update({
        where: { userId: user.id },
        data: {
          ...(bio !== undefined && { bio }),
          ...(skills !== undefined && { skills }),
          ...(hourlyRate !== undefined && { hourlyRate }),
          ...(category !== undefined && { category }),
          ...(portfolio !== undefined && { portfolio }),
        },
      });
    }
    
    if (paymentDetails?.method && paymentDetails?.value) {
      await saveFreelancerPaymentDetails(user.id, {
        method: paymentDetails.method,
        value: paymentDetails.value.trim(),
      });
    }

    const savedPaymentDetails = await getFreelancerPaymentDetails(user.id);

    res.json({
      success: true,
      data: {
        ...profile,
        paymentDetails: savedPaymentDetails || undefined,
      },
      message: 'Профиль обновлён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET FREELANCER REVIEWS
// ============================================

router.get('/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { toId: id },
        include: {
          from: {
            select: { id: true, name: true, avatar: true },
          },
          order: {
            select: { id: true, title: true, category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.review.count({ where: { toId: id } }),
    ]);
    
    // Calculate rating distribution
    const ratingDistribution = await prisma.review.groupBy({
      by: ['rating'],
      where: { toId: id },
      _count: { rating: true },
    });
    
    const distribution = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
    };
    
    ratingDistribution.forEach((r) => {
      distribution[r.rating as keyof typeof distribution] = r._count.rating;
    });
    
    res.json({
      success: true,
      data: reviews,
      distribution,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE AVATAR
// ============================================

router.put('/avatar', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    const { avatarUrl } = req.body;
    
    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        error: 'URL аватара обязателен',
      });
    }
    
    await prisma.user.update({
      where: { id: user.id },
      data: { avatar: avatarUrl },
    });
    
    res.json({
      success: true,
      message: 'Аватар обновлён',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TOGGLE AVAILABILITY
// ============================================

router.post('/toggle-availability', authMiddleware, freelancerOnly, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    
    const profile = await prisma.freelancerProfile.findUnique({
      where: { userId: user.id },
    });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Профиль не найден',
      });
    }
    
    const updatedProfile = await prisma.freelancerProfile.update({
      where: { userId: user.id },
      data: { isAvailable: !profile.isAvailable },
    });
    
    res.json({
      success: true,
      data: { isAvailable: updatedProfile.isAvailable },
      message: updatedProfile.isAvailable ? 'Вы доступны для заказов' : 'Вы скрыты от новых заказов',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
