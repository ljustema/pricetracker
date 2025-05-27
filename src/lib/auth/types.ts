import "next-auth";

// Extend the built-in session types from next-auth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      adminRole?: string | null;
      isAdmin?: boolean;
      isSuspended?: boolean;
    };
  }
}

// Extend the built-in JWT types from next-auth
declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    adminRole?: string | null;
    isSuspended?: boolean;
  }
}