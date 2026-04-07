import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { permissionGuard } from '../middleware/roleGuard';
import { auditLog } from '../lib/logger';
import {
  FEATURE_FLAGS,
  getDefaultFeatureFlags,
  getFeatureFlags,
  isFeatureFlagKey,
  setFeatureFlag,
} from '../lib/featureFlags';

const router = Router();

router.get('/flags', authMiddleware, permissionGuard('feature_flags.read'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [flags, defaults] = await Promise.all([getFeatureFlags(), Promise.resolve(getDefaultFeatureFlags())]);
    res.json({
      success: true,
      data: {
        flags,
        defaults,
        availableKeys: Object.values(FEATURE_FLAGS),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/flags/:key', authMiddleware, permissionGuard('feature_flags.manage', 'settings.manage'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const actor = req.user!;
    const { key } = req.params;
    const { enabled } = req.body as { enabled?: boolean };

    if (!isFeatureFlagKey(key)) {
      return res.status(400).json({
        success: false,
        error: 'Unknown feature flag key',
        availableKeys: Object.values(FEATURE_FLAGS),
      });
    }

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Field "enabled" must be boolean',
      });
    }

    const value = await setFeatureFlag(key, enabled, actor?.id);

    auditLog('FEATURE_FLAG_UPDATED', actor?.id || 'system', {
      flag: key,
      enabled: value,
    });

    res.json({
      success: true,
      data: { key, enabled: value },
      message: 'Feature flag updated',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

