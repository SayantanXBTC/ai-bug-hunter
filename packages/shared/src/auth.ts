export type UserRole = 'admin' | 'qa_engineer' | 'viewer';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}
