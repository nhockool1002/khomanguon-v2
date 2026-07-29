export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  emailVerified: boolean;
}

export interface Profile extends AuthUser {
  bio: string | null;
  createdAt: string;
  roles: string[];
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}
