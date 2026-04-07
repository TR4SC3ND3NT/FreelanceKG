export {};

declare global {
  namespace Express {
    interface User {
      id: string;
      role: 'CLIENT' | 'FREELANCER' | 'ADMIN';
      name: string;
      email: string;
      avatar?: string | null;
      token?: string;
      permissions?: string[];
    }

    interface Request {
      user: User;
      requestId?: string;
    }
  }
}
