import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAppStore = create(
  persist(
    (set, get) => ({
      // Auth state
      user: null,
      token: null,
      isAuthenticated: false,

      // UI state
      isLoading: false,
      error: null,

      // Data state
      listings: [],
      matches: [],
      conversations: [],
      appointments: [],

      // Onboarding state
      onboardingStep: 0,
      onboardingComplete: false,

      // Auth actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      login: (user, token) => set({ user, token, isAuthenticated: true }),
      logout: () => set({
        user: null, token: null, isAuthenticated: false,
        listings: [], matches: [], conversations: [], appointments: []
      }),

      // UI actions
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),

      // Data actions
      setListings: (listings) => set({ listings }),
      addListing: (listing) => set((state) => ({ listings: [...state.listings, listing] })),

      setMatches: (matches) => set({ matches }),
      updateMatch: (id, updates) => set((state) => ({
        matches: state.matches.map(m => m.id === id ? { ...m, ...updates } : m)
      })),

      setConversations: (conversations) => set({ conversations }),
      addMessage: (matchId, message) => set((state) => ({
        conversations: state.conversations.map(c =>
          c.match_id === matchId
            ? { ...c, last_message: message.content, last_message_at: message.created_at }
            : c
        )
      })),

      setAppointments: (appointments) => set({ appointments }),
      addAppointment: (appointment) => set((state) => ({
        appointments: [...state.appointments, appointment]
      })),

      // Onboarding actions
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      completeOnboarding: () => set({
        onboardingComplete: true,
        user: { ...get().user, onboardingComplete: true }
      }),
    }),
    {
      name: 'homeshare-storage',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAppStore;
