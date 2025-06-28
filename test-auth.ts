#!/usr/bin/env -S deno run -A --unstable-net

/**
 * Test script for PKCE OAuth authentication
 * Usage: deno run -A --unstable-net test-auth.ts
 */

import { ensureAuthenticated, getAuthStatus, logout } from "./driver/trpc/remote-cli/auth.ts";

async function testAuth() {
  console.log("🧪 Testing PKCE OAuth Authentication\n");

  try {
    // Test 1: Check initial auth status
    console.log("1. Checking initial authentication status...");
    const initialStatus = await getAuthStatus();
    console.log("Initial status:", initialStatus);
    console.log();

    // Test 2: Ensure authentication (will trigger OAuth flow if not authenticated)
    console.log("2. Ensuring authentication...");
    await ensureAuthenticated();
    console.log("✅ Authentication successful!");
    console.log();

    // Test 3: Check auth status after authentication
    console.log("3. Checking authentication status after login...");
    const authStatus = await getAuthStatus();
    console.log("Authenticated:", authStatus.authenticated);
    if (authStatus.user) {
      console.log("User ID:", authStatus.user.id);
      console.log("User email:", authStatus.user.email);
    }
    if (authStatus.expiresAt) {
      const expiresDate = new Date(authStatus.expiresAt);
      console.log("Token expires at:", expiresDate.toISOString());
    }
    console.log();

    // Test 4: Test logout
    console.log("4. Testing logout...");
    await logout();
    console.log("✅ Logout successful!");
    console.log();

    // Test 5: Check auth status after logout
    console.log("5. Checking authentication status after logout...");
    const logoutStatus = await getAuthStatus();
    console.log("Final status:", logoutStatus);

  } catch (error) {
    console.error("❌ Test failed:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await testAuth();
}
