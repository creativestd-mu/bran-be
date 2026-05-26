declare namespace Express {
  interface Request {
    language?: string;
    user?: {
      userId: string;
      email: string;
      roleId: string;
      roleName: string;
    };
  }
}
