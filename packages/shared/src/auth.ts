export type UserRole = 'admin' | 'qa_engineer' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  /** Profile photo URL (set for Google sign-ins). */
  avatarUrl?: string | null;
  displayName?: string | null;
}
