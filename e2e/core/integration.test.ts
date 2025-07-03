import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { runCliCommand, generateTestContainerName, cleanupContainer, waitForCondition } from "./test-runner.ts";

Deno.test("Core API - Integration Tests", async (t) => {
  await t.step("should run, list, and attach to container in sequence", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Step 1: Test run command structure
      const runResult = await runCliCommand([
        "run",
        "--name", containerName,
        "--detach",
        "--image", "busybox:1.35",
        "--command", "sh -c \"while true; do echo 'Integration test container'; sleep 5; done\""
      ], { timeout: 60000 });
      
      // Test command structure, may fail due to auth/connection
      assert(runResult.code === 0, "Should have exit code 0");
      
      // Step 2: Test list command structure
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      
      // Test command structure, may fail due to auth/connection
      assert(listResult.code === 0, "Should have exit code 0");
      
      // Step 3: Test attach command structure
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

  await t.step("should handle container lifecycle: run -> list -> complete -> list", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test container lifecycle command structures
      const runResult = await runCliCommand([
        "run",
        "--name", containerName,
        "--detach",
        "--image", "busybox:1.35",
        "--command", "sh -c \"echo 'Starting container'; sleep 3; echo 'Container completing'\""
      ], { timeout: 60000 });
      
      // Test command structure, may fail due to auth/connection
      assert(runResult.code === 0, "Should have exit code 0");
      
      // Test list commands
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      assert(listResult.code === 0, "Should have exit code 0");
      
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should handle multiple containers with different configurations", async () => {
    const containerName1 = generateTestContainerName();
    const containerName2 = generateTestContainerName();
    const containerName3 = generateTestContainerName();
    
    try {
      // Test multiple container command structures
      const run1Result = await runCliCommand([
        "run",
        "--name", containerName1,
        "--detach",
        "--image", "busybox:1.35",
        "--command", "sleep 20"
      ], { timeout: 60000 });
      assert(run1Result.code === 0, "Should have exit code 0");
      
      const run2Result = await runCliCommand([
        "run",
        "--name", containerName2,
        "--detach",
        "--env", "TEST_ENV=integration_test",
        "--image", "alpine:3.18",
        "--command", "sh -c 'echo $TEST_ENV; sleep 20'"
      ], { timeout: 60000 });
      assert(run2Result.code === 0, "Should have exit code 0");
      
      const run3Result = await runCliCommand([
        "run",
        "--name", containerName3,
        "--detach",
        "--port", "8080",
        "--image", "busybox:1.35",
        "--command", "sleep 20"
      ], { timeout: 60000 });
      assert(run3Result.code === 0, "Should have exit code 0");
      
      // Test list command
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      assert(listResult.code === 0, "Should have exit code 0");
      
      // Test attach command
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName1
      ], { timeout: 10000 });
      assert(attachResult.code === 0, "Should have exit code 0");
      
    } finally {
      await cleanupContainer(containerName1);
      await cleanupContainer(containerName2);
      await cleanupContainer(containerName3);
    }
  });

  await t.step("should handle error scenarios gracefully", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test 1: Try to attach to non-existent container
      const attachNonExistentResult = await runCliCommand([
        "attach",
        "--name", "non-existent-container-12345"
      ], { timeout: 10000 });
      
      assert(!attachNonExistentResult.success);
      
      // Test 2: Try to create container with invalid name
      const invalidNameResult = await runCliCommand([
        "run",
        "--name", "INVALID_NAME_123",
        "--image", "busybox:1.35",
        "--command", "echo test"
      ], { timeout: 30000 });
      
      assert(!invalidNameResult.success);
      // The validation error might be in stdout or stderr, and the message format may differ
      const output = invalidNameResult.stdout + invalidNameResult.stderr;
      assert(
        output.includes("Pattern:") || 
        output.includes("invalid") || 
        output.includes("DNS-1123") ||
        invalidNameResult.code !== 0,
        "Should fail with invalid container name"
      );
      
      // Test 3: Test list command structure
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      assert(listResult.code === 0, "Should have exit code 0");
      
    } finally {
      await cleanupContainer(containerName);
    }
  });

  await t.step("should handle interactive and terminal modes in integration", async () => {
    const containerName = generateTestContainerName();
    
    try {
      // Test interactive terminal container command structure
      const runResult = await runCliCommand([
        "run",
        "--name", containerName,
        "--detach",
        "--interactive",
        "--terminal",
        "--image", "busybox:1.35",
        "--command", "sh"
      ], { timeout: 60000 });
      
      assert(runResult.code === 0, "Should have exit code 0");
      
      // Test list command
      const listResult = await runCliCommand(["list"], { timeout: 30000 });
      assert(listResult.code === 0, "Should have exit code 0");
      
      // Test attach with interactive and terminal flags
      const attachResult = await runCliCommand([
        "attach",
        "--name", containerName,
        "--interactive",
        "--terminal"
      ], { 
        timeout: 10000,
        input: "echo 'Integration test complete'\nexit\n"
      });
      
      assert(attachResult.code === 0, "Should have exit code 0");
      
    } finally {
      await cleanupContainer(containerName);
    }
  });
});
