import { AuthClientContext } from "ctx/mod.ts";

export default async ({ ctx }: { ctx: AuthClientContext }) => {
  try {
    // Clear Supabase session
    await ctx.auth.client.signOut();
    console.info("🔓 Logged out successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("❌ Error during logout:", message);
  }
};
