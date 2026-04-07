import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a password
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate random password
 */
export const generateRandomPassword = (length: number = 12): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

/**
 * Validate password strength
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Пароль должен быть минимум 6 символов');
  }

  if (password.length > 128) {
    errors.push('Пароль слишком длинный');
  }

  // Optional: Add more rules
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Пароль должен содержать заглавную букву');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Пароль должен содержать цифру');
  // }

  return {
    isValid: errors.length === 0,
    errors
  };
};
