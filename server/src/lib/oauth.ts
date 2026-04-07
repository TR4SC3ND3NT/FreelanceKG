import crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { prisma } from './prisma';
import { generateToken } from './jwt';
import { logger } from './logger';
import { env, oauthProviders } from '../config/env';
import { hashPassword } from './password';

export type OAuthProvider = 'google' | 'github';

export const oauthCapabilities = {
  enabled: env.ENABLE_OAUTH,
  devMockEnabled: env.NODE_ENV !== 'production' && env.DEV_OAUTH_MOCK,
  googleConfigured: oauthProviders.google,
  githubConfigured: oauthProviders.github,
};

export function isOAuthProviderConfigured(provider: OAuthProvider): boolean {
  return provider === 'google' ? oauthCapabilities.googleConfigured : oauthCapabilities.githubConfigured;
}

export function isOAuthProviderAvailable(provider: OAuthProvider): boolean {
  if (!oauthCapabilities.enabled) return false;
  return isOAuthProviderConfigured(provider);
}

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        role: true,
      },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

async function attachSessionToken(userId: string, role: 'CLIENT' | 'FREELANCER' | 'ADMIN') {
  const token = generateToken({ userId, role });
  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return token;
}

if (oauthCapabilities.enabled && oauthCapabilities.googleConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID!,
        clientSecret: env.GOOGLE_CLIENT_SECRET!,
        callbackURL: env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;

          if (!email) {
            return done(new Error('Email не получен от Google'), undefined);
          }

          let user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            if (!user.avatar && profile.photos?.[0]?.value) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { avatar: profile.photos[0].value },
              });
            }
          } else {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName || email.split('@')[0],
                avatar: profile.photos?.[0]?.value || null,
                password: await hashPassword(crypto.randomBytes(32).toString('hex')),
                role: 'CLIENT',
                isEmailVerified: true,
                oauthProvider: 'google',
                oauthId: profile.id,
              },
            });
          }

          const token = await attachSessionToken(user.id, user.role);
          return done(null, { ...user, token });
        } catch (error) {
          logger.error('Google OAuth error', { error });
          return done(error as Error, undefined);
        }
      }
    )
  );

  logger.info('Google OAuth strategy configured');
} else {
  logger.warn('Google OAuth not configured or disabled');
}

if (oauthCapabilities.enabled && oauthCapabilities.githubConfigured) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: env.GITHUB_CLIENT_ID!,
        clientSecret: env.GITHUB_CLIENT_SECRET!,
        callbackURL: env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        scope: ['user:email'],
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          let email = profile.emails?.[0]?.value;

          if (!email) {
            const response = await fetch('https://api.github.com/user/emails', {
              headers: {
                Authorization: `token ${accessToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });

            if (response.ok) {
              const emails = (await response.json()) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
              const primaryEmail = emails.find((entry) => entry.primary && entry.verified);
              email = primaryEmail?.email || emails[0]?.email;
            }
          }

          if (!email) {
            return done(new Error('Email не получен от GitHub'), undefined);
          }

          let user = await prisma.user.findUnique({ where: { email } });

          if (user) {
            if (!user.avatar && profile.photos?.[0]?.value) {
              user = await prisma.user.update({
                where: { id: user.id },
                data: { avatar: profile.photos[0].value },
              });
            }
          } else {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName || profile.username || email.split('@')[0],
                avatar: profile.photos?.[0]?.value || null,
                password: await hashPassword(crypto.randomBytes(32).toString('hex')),
                role: 'CLIENT',
                isEmailVerified: true,
                oauthProvider: 'github',
                oauthId: profile.id,
              },
            });
          }

          const token = await attachSessionToken(user.id, user.role);
          return done(null, { ...user, token });
        } catch (error) {
          logger.error('GitHub OAuth error', { error });
          return done(error as Error, undefined);
        }
      }
    )
  );

  logger.info('GitHub OAuth strategy configured');
} else {
  logger.warn('GitHub OAuth not configured or disabled');
}

export async function loginWithDevOAuth(provider: OAuthProvider) {
  if (!oauthCapabilities.devMockEnabled) {
    throw new Error('Dev OAuth mock is disabled');
  }

  const email = provider === 'google' ? 'dev-google@freelancekg.local' : 'dev-github@freelancekg.local';
  const name = provider === 'google' ? 'Dev Google User' : 'Dev GitHub User';

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'CLIENT',
        password: await hashPassword(crypto.randomBytes(32).toString('hex')),
        isEmailVerified: true,
        oauthProvider: provider,
        oauthId: `dev-${provider}`,
      },
    });
  }

  const token = await attachSessionToken(user.id, user.role);
  return { user, token };
}

export default passport;
