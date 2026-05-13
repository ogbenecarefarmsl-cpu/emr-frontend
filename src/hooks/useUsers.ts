import { usersAPI } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppRole } from '@/types/lis';

interface UserWithRoles {
  id: string;
  email: string;
  full_name: string;
  department: string | null;
  avatar_url: string | null;
  created_at: string;
  user_roles: Array<{
    id: string;
    role: AppRole;
    created_at: string;
  }>;
}

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await usersAPI.getAll();
      
      // Transform backend response to match frontend interface
      const users: UserWithRoles[] = response.users.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        department: user.department || null,
        avatar_url: user.avatarUrl || null,
        created_at: user.createdAt,
        user_roles: user.roles.map((role: string, index: number) => ({
          id: `${user.id}-${role}`,
          role: role as AppRole,
          created_at: user.createdAt
        }))
      }));

      return users;
    },
  });
}

export function useAssignRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      return await usersAPI.assignRole(userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useRemoveRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      return await usersAPI.removeRole(userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useCreateUserRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      return await usersAPI.assignRole(user_id, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useDeleteUserRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (roleId: string) => {
      // Extract userId and role from roleId (format: userId-role)
      const [userId, role] = roleId.split('-');
      return await usersAPI.removeRole(userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
