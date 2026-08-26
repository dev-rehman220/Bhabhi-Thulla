import create from 'zustand';

type AuthUser = {
	id: string;
	name: string;
	avatarUrl?: string;
	isGuest?: boolean;
};

type AuthState = {
	user?: AuthUser | null;
	token: string | null;
	setUser: (u: AuthUser | null) => void;
	setToken: (token: string | null) => void;
	reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
	user: null,
	token: null,
	setUser: (user) => set({ user }),
	setToken: (token) => set({ token }),
	reset: () => set({ user: null, token: null }),
}));
