// Supabase has been replaced with NestJS + MongoDB backend
// This file is kept for compatibility but should not be used

export const supabase = {
  auth: {
    signIn: () => Promise.reject(new Error('Supabase is deprecated')),
    signOut: () => Promise.reject(new Error('Supabase is deprecated')),
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
  },
  from: () => ({
    select: () => ({
      eq: () => Promise.resolve({ data: [], error: null }),
    }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => Promise.resolve({ data: null, error: null }),
    delete: () => Promise.resolve({ data: null, error: null }),
  }),
};

export type Database = any;
