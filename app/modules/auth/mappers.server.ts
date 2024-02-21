import type { AuthSession } from "server/session";
import type { SupabaseAuthSession } from "~/integrations/supabase";

import { ShelfStackError } from "~/utils/error";

export async function mapAuthSession(
  supabaseAuthSession: SupabaseAuthSession | null
): Promise<AuthSession> {
  if (!supabaseAuthSession) {
    throw new ShelfStackError({
      message: "Supabase auth session is null",
    });
  }

  if (!supabaseAuthSession.refresh_token)
    throw new ShelfStackError({ message: "User should have a refresh token" });

  if (!supabaseAuthSession.user?.email)
    throw new ShelfStackError({ message: "User should have an email" });

  return {
    accessToken: supabaseAuthSession.access_token,
    refreshToken: supabaseAuthSession.refresh_token,
    userId: supabaseAuthSession.user.id,
    email: supabaseAuthSession.user.email,
    expiresIn: supabaseAuthSession.expires_in ?? -1,
    expiresAt: supabaseAuthSession.expires_at ?? -1,
  };
}
