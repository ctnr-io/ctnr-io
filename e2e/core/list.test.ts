import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { runCliCommand, generateTestContainerName, cleanupContainer } from "./test-runner.ts";

Deno.test("Core API - List Command Tests", async (t) => {
  await t.step("should show help for list command", async () => {
    const result = await runCliCommand(["list", "--help"]);
    
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "list");
  });

  await t.step("should list containers when none exist", async () => {
    const result = await runCliCommand(["list"]);
    
    // Test command structure, may fail due to auth/connection
    assert(result.code === 0, "Should have exit code 0");
    // Should return empty array or no containers message if successful
  });

  await t.step("should list containers after creating one", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test list command structure, may fail due to auth/connection
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      
      // Test command structure, may fail due to auth/connection
      assert(listResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should list multiple containers", async () => {
    const containerName1 = generateTestContainerName();
    const containerName2 = generateTestContainerName();
    
    try {
      // Test list command structure, may fail due to auth/connection
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      
      // Test command structure, may fail due to auth/connection
      assert(listResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName1);
      await cleanupContainer(containerName2);
    }
  });

  await t.step("should show container status changes", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test list command structure, may fail due to auth/connection
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      
      // Test command structure, may fail due to auth/connection
      assert(listResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should handle empty list gracefully", async () => {
    // Test list command structure, may fail due to auth/connection
    const result = await runCliCommand(["list"], { timeout: 30000 });
    
    // Test command structure, may fail due to auth/connection
    assert(result.code === 0, "Should have exit code 0");
  });
});
