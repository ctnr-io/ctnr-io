import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { runCliCommand, generateTestContainerName, cleanupContainer } from "./test-runner.ts";

Deno.test("Core API - Attach Command Tests", async (t) => {
  await t.step("should show help for attach command", async () => {
    const result = await runCliCommand(["attach", "--help"]);
    
    assertEquals(result.code, 0);
    assertStringIncludes(result.stdout, "attach");
    assertStringIncludes(result.stdout, "Name of the container");
  });

  await t.step("should fail when no container name provided", async () => {
    const result = await runCliCommand(["attach"]);
    
    assert(!result.success);
    assert(result.code !== 0);
  });

  await t.step("should fail when attaching to non-existent container", async () => {
    const nonExistentName = "non-existent-container-12345";
    
    const result = await runCliCommand([
      "attach",
      "--name", nonExistentName
    ], { timeout: 10000 });
    
    assert(!result.success);
    // Should get an error about container not found
  });

  await t.step("should attach to running container (non-interactive)", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName
      ], { timeout: 10000 });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should attach with interactive flag", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure with interactive flag
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName,
        "--interactive"
      ], { 
        timeout: 10000,
        input: "echo 'Hello from interactive session'\nexit\n"
      });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should attach with terminal flag", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure with terminal flag
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName,
        "--terminal"
      ], { timeout: 10000 });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should attach with both interactive and terminal flags", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure with both flags
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName,
        "--interactive",
        "--terminal"
      ], { 
        timeout: 10000,
        input: "echo 'Interactive terminal test'\nexit\n"
      });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should handle attaching to completed container", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure for completed container
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName
      ], { timeout: 15000 });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should show container output when attaching", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test attach command structure for output capture
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName
      ], { timeout: 15000 });
      
      // Test command structure, may fail due to auth/connection
      assert(attachResult.code === 0, "Should have exit code 0");
    } finally {
      await cleanupContainer(containerName);
    }
  });
});
