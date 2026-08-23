// Type augmentation for Express request objects.

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: { id: string; email: string; role: 'admin' | 'qa_engineer' | 'viewer' } | undefined;
      ciToken?: { id: string; applicationId: string | null } | undefined;
    }
  }
}

export {};
